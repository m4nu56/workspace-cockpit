import json
import os
from pathlib import Path

import pytest
from cockpit import sessions
from cockpit.sessions import list_sessions, session_detail

ROOT = "/home/dev/work"
UUID = "0aa229a4-a2e8-43d4-9bea-a1e888e7247d"


def jsonl(path: Path, lines: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(l) + "\n" for l in lines) + "{not json\n")


def user(text, ts, cwd=ROOT, **x):
    return {"type": "user", "cwd": cwd, "timestamp": ts, "gitBranch": "main", "message": {"role": "user", "content": text}, **x}


def assistant(mid, content, ts, usage=None):
    return {"type": "assistant", "timestamp": ts, "message": {"id": mid, "model": "claude-model", "content": content,
                                                               "usage": usage or {"input_tokens": 0, "output_tokens": 0}}}


@pytest.fixture
def claude(tmp_path: Path) -> Path:
    p = tmp_path / "projects"
    jsonl(p / "-home-dev-work" / "aaa.jsonl", [
        {"type": "last-prompt", "lastPrompt": "old"},
        user("<command-name>/clear</command-name>", "2026-09-01T08:00:00Z"),
        user("First real prompt", "2026-09-01T08:00:05Z"),
        {"type": "assistant", "timestamp": "2026-09-01T08:01:00Z", "message": {"content": []}},
        user([{"type": "tool_result", "content": "x"}], "2026-09-01T08:02:00Z"),
        user([{"type": "text", "text": "Second prompt"}], "2026-09-01T09:00:00Z"),
        {"type": "ai-title", "aiTitle": "Old title"},
        {"type": "ai-title", "aiTitle": "Final title"},
        {"type": "last-prompt", "lastPrompt": "Second prompt"},
    ])
    jsonl(p / "-home-dev-work-projects-alpha" / "bbb.jsonl", [user("In alpha", "2026-09-02T10:00:00Z", cwd=ROOT + "/projects/alpha")])
    jsonl(p / "-home-dev-workx" / "ccc.jsonl", [user("Outside", "2026-09-02T10:00:00Z", cwd="/home/dev/workx")])
    jsonl(p / "-home-dev-work" / "aaa" / "subagents" / "agent-1.jsonl", [user("subagent", "2026-09-01T08:00:00Z")])
    (p / "-home-dev-work" / "empty.jsonl").write_text("")
    s = tmp_path / "sessions"
    s.mkdir()
    (s / f"{os.getpid()}.json").write_text(json.dumps({"pid": os.getpid(), "sessionId": "bbb", "cwd": ROOT + "/projects/alpha",
                                                        "status": "busy", "name": "alpha-12", "startedAt": 1790000000000}))
    (s / "999999.json").write_text(json.dumps({"pid": 999999, "sessionId": "aaa", "cwd": ROOT, "status": "idle", "name": "dead"}))
    (s / f"{os.getppid()}.json").write_text(json.dumps({"pid": os.getppid(), "sessionId": "new", "cwd": ROOT + "/tools",
                                                         "status": "idle", "name": "tools-1", "startedAt": 1790000000000}))
    (s / "broken.json").write_text("{")
    return tmp_path


def by_id(claude, cache=None):
    return {s["id"]: s for s in list_sessions(claude, ROOT, cache)}


def test_title_prompts_dates(claude):
    a = by_id(claude)["aaa"]
    assert a["title"] == "Final title" and a["first_prompt"] == "First real prompt" and a["last_prompt"] == "Second prompt"
    assert a["start"] == "2026-09-01T08:00:00Z" and a["end"] == "2026-09-01T09:00:00Z"
    assert a["prompts"] == 2 and a["folder"] == "" and a["branch"] == "main"


def test_root_filter_ignores_subagents_and_empty(claude):
    assert set(by_id(claude)) == {"aaa", "bbb", "new"}


def test_open_state(claude):
    s = by_id(claude)
    assert s["bbb"]["open"] and s["bbb"]["state"] == "busy" and s["bbb"]["name"] == "alpha-12" and s["bbb"]["folder"] == "projects/alpha"
    assert not s["aaa"]["open"] and s["aaa"]["state"] is None


def test_open_session_without_transcript(claude):
    n = by_id(claude)["new"]
    assert n["open"] and n["folder"] == "tools" and n["title"] == "" and n["start"].startswith("2026-")


def test_cache_rereads_only_changed_transcripts(claude, tmp_path, monkeypatch):
    cache = tmp_path / "cache.json"
    first = by_id(claude, cache)
    read = []
    real = sessions.read_transcript
    monkeypatch.setattr(sessions, "read_transcript", lambda p: read.append(p.stem) or real(p))
    assert by_id(claude, cache) == first and read == []
    with open(claude / "projects" / "-home-dev-work" / "aaa.jsonl", "a") as fh:
        fh.write(json.dumps({"type": "ai-title", "aiTitle": "New title"}) + "\n")
    assert by_id(claude, cache)["aaa"]["title"] == "New title" and read == ["aaa"]


def test_unreadable_cache_ignored(claude, tmp_path):
    cache = tmp_path / "cache.json"
    cache.write_text("{not json")
    assert len(list_sessions(claude, ROOT, cache)) == 3


def test_claude_dir_env(monkeypatch, tmp_path):
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(tmp_path))
    assert sessions.claude_dir() == tmp_path
    monkeypatch.delenv("CLAUDE_CONFIG_DIR")
    assert sessions.claude_dir() == Path.home() / ".claude"


@pytest.fixture
def detailed(claude: Path) -> Path:
    u = {"input_tokens": 10, "output_tokens": 5, "cache_read_input_tokens": 100, "cache_creation_input_tokens": 20}
    jsonl(claude / "projects" / "-home-dev-work" / f"{UUID}.jsonl", [
        user("Fix the bug\n\non two lines", "2026-09-01T08:00:00Z"),
        assistant("m1", [{"type": "thinking", "thinking": ""}], "2026-09-01T08:00:10Z", u),
        assistant("m1", [{"type": "tool_use", "id": "t1", "name": "Edit", "input": {"file_path": ROOT + "/projects/alpha/a.md"}}], "2026-09-01T08:00:11Z", u),
        user([{"type": "tool_result", "tool_use_id": "t1", "content": "ok"}], "2026-09-01T08:00:12Z"),
        assistant("m2", [{"type": "tool_use", "id": "t2", "name": "Write", "input": {"file_path": "/tmp/outside.txt"}},
                         {"type": "tool_use", "id": "t3", "name": "Edit", "input": {"file_path": ROOT + "/projects/alpha/a.md"}},
                         {"type": "tool_use", "id": "t4", "name": "Agent", "input": {"prompt": "x"}},
                         {"type": "tool_use", "id": "t5", "name": "Bash", "input": {"command": "gh pr create"}}], "2026-09-01T08:01:00Z", u),
        user([{"type": "tool_result", "tool_use_id": "t5", "content": [{"type": "text", "text": "https://github.com/acme/app/pull/571\n"}]}], "2026-09-01T08:01:05Z"),
        assistant("m3", [{"type": "text", "text": "See https://github.com/acme/app/issues/12 and https://github.com/acme/app/pull/571."}], "2026-09-01T08:02:00Z"),
        user("Thanks", "2026-09-01T08:03:00Z"),
        assistant("m4", [{"type": "text", "text": "## Done\n\nAll **done**."}], "2026-09-01T08:04:00Z"),
    ])
    return claude


def test_detail(detailed):
    d = session_detail(detailed, ROOT, UUID)
    assert [p["text"] for p in d["prompts"]] == ["Fix the bug\n\non two lines", "Thanks"]
    assert d["prompts"][0]["timestamp"] == "2026-09-01T08:00:00Z" and d["model"] == "claude-model"
    assert d["tokens"] == {"input": 20, "output": 10, "cache_read": 200, "cache_write": 40}
    assert d["replies"] == 2 and d["subagents"] == 1 and d["tools"] == {"Edit": 2, "Write": 1, "Agent": 1, "Bash": 1}
    assert d["files"] == [{"path": "projects/alpha/a.md", "absolute": ROOT + "/projects/alpha/a.md", "edits": 2},
                          {"path": "/tmp/outside.txt", "absolute": "/tmp/outside.txt", "edits": 1}]
    assert d["links"] == ["https://github.com/acme/app/pull/571", "https://github.com/acme/app/issues/12"]
    assert d["last_reply"] == "## Done\n\nAll **done**."


def test_detail_refusals(detailed):
    with pytest.raises(ValueError):
        session_detail(detailed, ROOT, "../../etc/passwd")
    with pytest.raises(LookupError):
        session_detail(detailed, ROOT, "11111111-2222-3333-4444-555555555555")
    other = "99999999-2222-3333-4444-555555555555"
    jsonl(detailed / "projects" / "-x" / f"{other}.jsonl", [user("outside", "2026-09-01T08:00:00Z", cwd="/elsewhere")])
    with pytest.raises(LookupError):
        session_detail(detailed, ROOT, other)
