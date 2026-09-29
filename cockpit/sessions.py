"""Claude Code sessions started inside the workspace: history (transcripts under <claude>/projects) and
sessions open right now (<claude>/sessions/<pid>.json with a live process). READ-ONLY."""
from __future__ import annotations

import datetime as dt
import json
import os
import re
from collections import Counter
from pathlib import Path

CACHE = Path.home() / ".cache" / "workspace-cockpit" / "sessions.json"
CACHE_VERSION = 1
EXCERPT = 200
MAX_TEXT = 20_000
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
GITHUB_LINK = re.compile(r"https://github\.com/[\w.-]+/[\w.-]+/(?:pull|issues)/\d+")
WRITE_TOOLS = ("Edit", "Write", "MultiEdit", "NotebookEdit")
AGENT_TOOLS = ("Agent", "Task")


def claude_dir() -> Path:
    """Claude Code's config folder: $CLAUDE_CONFIG_DIR, else ~/.claude."""
    return Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude").expanduser()


def _inside(cwd: str, root: str) -> bool:
    return cwd == root or cwd.startswith(root + "/")


def _relative(cwd: str, root: str) -> str:
    return "" if cwd == root else cwd[len(root) + 1:]


def _prompt_text(message: dict, full: bool = False) -> str | None:
    """What the user typed, or None (tool result, slash command, system reminder).
    full: whole text with its line breaks, else a one-line excerpt."""
    content = message.get("content")
    if isinstance(content, list):
        texts = [c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"]
        if not texts or any(isinstance(c, dict) and c.get("type") == "tool_result" for c in content):
            return None
        content = "\n".join(texts)
    if not isinstance(content, str):
        return None
    content = content.strip()
    if not content or content.startswith("<"):
        return None
    return content[:MAX_TEXT] if full else " ".join(content.split())[:EXCERPT]


def read_transcript(path: Path) -> dict | None:
    s: dict = {"id": path.stem, "cwd": None, "title": "", "first_prompt": "", "last_prompt": "",
               "start": None, "end": None, "prompts": 0, "branch": ""}
    try:
        handle = open(path, errors="replace")
    except OSError:
        return None
    with handle:
        for line in handle:
            # Cheap pre-filter: most lines are large tool outputs carrying none of these keys.
            if '"cwd"' not in line and '"aiTitle"' not in line and '"lastPrompt"' not in line and '"timestamp"' not in line:
                continue
            try:
                e = json.loads(line)
            except ValueError:
                continue
            if not isinstance(e, dict):
                continue
            if e.get("cwd") and not s["cwd"]:
                s["cwd"] = e["cwd"]
            if e.get("gitBranch"):
                s["branch"] = e["gitBranch"]
            ts = e.get("timestamp")
            if isinstance(ts, str):
                s["start"] = s["start"] or ts
                s["end"] = ts
            if e.get("type") == "ai-title" and e.get("aiTitle"):
                s["title"] = e["aiTitle"]
            elif e.get("type") == "last-prompt" and e.get("lastPrompt"):
                s["last_prompt"] = " ".join(str(e["lastPrompt"]).split())[:EXCERPT]
            elif e.get("type") == "user" and not e.get("isMeta") and isinstance(e.get("message"), dict):
                text = _prompt_text(e["message"])
                if text:
                    s["prompts"] += 1
                    s["first_prompt"] = s["first_prompt"] or text
    return s if s["cwd"] else None


def _alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except PermissionError:
        return True
    except (OSError, OverflowError):
        return False
    return True


def open_sessions(claude: Path) -> dict[str, dict]:
    found: dict[str, dict] = {}
    for f in sorted((claude / "sessions").glob("*.json")):
        try:
            d = json.loads(f.read_text())
        except (OSError, ValueError):
            continue
        if isinstance(d, dict) and d.get("sessionId") and isinstance(d.get("pid"), int) and _alive(d["pid"]):
            found[d["sessionId"]] = d
    return found


def _read_cache(cache: Path | None) -> dict:
    if cache is None:
        return {}
    try:
        d = json.loads(cache.read_text())
    except (OSError, ValueError):
        return {}
    return d.get("transcripts", {}) if isinstance(d, dict) and d.get("version") == CACHE_VERSION else {}


def _write_cache(cache: Path | None, transcripts: dict) -> None:
    if cache is None:
        return
    try:
        cache.parent.mkdir(parents=True, exist_ok=True)
        tmp = cache.with_suffix(".tmp")
        tmp.write_text(json.dumps({"version": CACHE_VERSION, "transcripts": transcripts}))
        os.replace(tmp, cache)
    except OSError:
        pass  # the cache only saves time


def list_sessions(claude: Path, root: str, cache: Path | None = None) -> list[dict]:
    """cache: JSON file of transcripts already read, re-read only when their mtime or size changes."""
    root = root.rstrip("/")
    live = open_sessions(claude)
    known = _read_cache(cache)
    transcripts: dict = {}
    out: dict[str, dict] = {}
    for f in (claude / "projects").glob("*/*.jsonl"):
        try:
            st = f.stat()
        except OSError:
            continue
        key, fingerprint = str(f), [st.st_mtime, st.st_size]
        entry = known.get(key)
        s = entry["session"] if entry and entry.get("fingerprint") == fingerprint else read_transcript(f)
        transcripts[key] = {"fingerprint": fingerprint, "session": s}
        if s and _inside(s["cwd"], root):
            out[s["id"]] = dict(s)
    _write_cache(cache, transcripts)
    for sid, o in live.items():
        cwd = o.get("cwd", "")
        if sid not in out and _inside(cwd, root):
            start = dt.datetime.fromtimestamp(o.get("startedAt", 0) / 1000, dt.timezone.utc).isoformat().replace("+00:00", "Z")
            out[sid] = {"id": sid, "cwd": cwd, "title": "", "first_prompt": "", "last_prompt": "",
                        "start": start, "end": start, "prompts": 0, "branch": ""}
    for s in out.values():
        o = live.get(s["id"])
        s["folder"] = _relative(s["cwd"], root)
        s["open"] = o is not None
        s["state"] = o.get("status") if o else None
        s["name"] = o.get("name", "") if o else ""
        s["pid"] = o.get("pid") if o else None
    return sorted(out.values(), key=lambda s: s["end"] or "", reverse=True)


def _texts(content) -> list[str]:
    """Raw text of a message or tool result content (string or list of blocks)."""
    if isinstance(content, str):
        return [content]
    if isinstance(content, list):
        out = []
        for c in content:
            if isinstance(c, dict):
                if isinstance(c.get("text"), str):
                    out.append(c["text"])
                out += _texts(c.get("content"))
        return out
    return []


def session_detail(claude: Path, root: str, session_id: str) -> dict:
    """Prompts, edited files, GitHub links, tokens, tools and last reply of one session.
    ValueError for a malformed id, LookupError for an unknown session or one outside the root."""
    if not UUID.fullmatch(session_id):
        raise ValueError(f"Invalid session id: {session_id}")
    root = root.rstrip("/")
    files = list((claude / "projects").glob(f"*/{session_id}.jsonl"))
    summary = read_transcript(files[0]) if files else None
    if not summary or not _inside(summary["cwd"], root):
        raise LookupError(f"Unknown session under {root}: {session_id}")
    prompts: list[dict] = []
    usages: dict[str, dict] = {}
    tools: Counter = Counter()
    edited: Counter = Counter()
    links: list[str] = []
    model, last_reply, replies = "", "", set()

    def note_links(texts: list[str]) -> None:
        for t in texts:
            for link in GITHUB_LINK.findall(t):
                if link not in links:
                    links.append(link)

    with open(files[0], errors="replace") as handle:
        for line in handle:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            if not isinstance(e, dict) or e.get("isSidechain") or not isinstance(e.get("message"), dict):
                continue
            m = e["message"]
            if e.get("type") == "user" and not e.get("isMeta"):
                text = _prompt_text(m, full=True)
                if text:
                    prompts.append({"timestamp": e.get("timestamp"), "text": text})
                else:
                    note_links(_texts(m.get("content")))
            elif e.get("type") == "assistant":
                model = m.get("model") or model
                if isinstance(m.get("usage"), dict):
                    usages[m.get("id") or str(len(usages))] = m["usage"]  # streamed lines repeat the same usage
                for c in m.get("content") or []:
                    if not isinstance(c, dict):
                        continue
                    if c.get("type") == "text" and c.get("text", "").strip():
                        last_reply = c["text"][:MAX_TEXT]
                        replies.add(m.get("id"))
                        note_links([c["text"]])
                    elif c.get("type") == "tool_use":
                        name = c.get("name", "?")
                        tools[name] += 1
                        target = (c.get("input") or {}).get("file_path") or (c.get("input") or {}).get("notebook_path")
                        if name in WRITE_TOOLS and isinstance(target, str):
                            edited[target] += 1

    total = lambda key: sum(int(u.get(key) or 0) for u in usages.values())  # noqa: E731
    return {
        "id": session_id, "model": model, "prompts": prompts, "replies": len(replies),
        "subagents": sum(tools[n] for n in AGENT_TOOLS), "tools": dict(tools.most_common()),
        "tokens": {"input": total("input_tokens"), "output": total("output_tokens"),
                   "cache_read": total("cache_read_input_tokens"), "cache_write": total("cache_creation_input_tokens")},
        "files": [{"path": _relative(f, root) if _inside(f, root) else f, "absolute": f, "edits": n}
                  for f, n in edited.most_common()],
        "links": links, "last_reply": last_reply,
    }
