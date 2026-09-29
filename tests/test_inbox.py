import json
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import TODAY, write
from cockpit.inbox import add, delete, list_todos, mark_done, promote, undo
from cockpit.workspace import HeaderError

REPO = Path(__file__).resolve().parent.parent
NEXT_DAY = TODAY.replace(day=29)


def texts(config, done=None):
    return [t["text"] for t in list_todos(config) if done is None or t["done"] == done]


def test_missing_file_is_an_empty_inbox(config):
    assert list_todos(config) == []


def test_add_creates_the_file_with_its_sections(config, root):
    t = add("Call the vendor", config, TODAY)
    assert t == {"n": 1, "done": False, "added": "2026-09-28", "finished": "", "text": "Call the vendor"}
    text = (root / "INBOX.md").read_text()
    assert "## To do\n\n- [ ] 2026-09-28 · Call the vendor\n" in text and "## Done\n" in text


def test_inbox_file_is_configurable(config, root):
    add("x", replace(config, inbox_file="TODO.md"), TODAY)
    assert (root / "TODO.md").exists() and not (root / "INBOX.md").exists()


def test_add_goes_after_open_todos_before_done(config):
    add("one", config, TODAY)
    add("two", config, TODAY)
    mark_done(1, "one", config, NEXT_DAY)
    add("three", config, TODAY)
    assert texts(config) == ["two", "three", "one"]


def test_add_refuses_empty_and_multiline(config, root):
    for bad in ("  ", "a\nb"):
        with pytest.raises(HeaderError):
            add(bad, config, TODAY)
    assert not (root / "INBOX.md").exists()


def test_done_moves_to_top_of_done_with_date(config, root):
    add("one", config, TODAY)
    add("two", config, TODAY)
    mark_done(1, "one", config, NEXT_DAY)
    mark_done(1, "two", config, NEXT_DAY)
    assert texts(config, done=True) == ["two", "one"]
    assert "- [x] 2026-09-28 → 2026-09-29 · two\n- [x] 2026-09-28 → 2026-09-29 · one\n" in (root / "INBOX.md").read_text()


def test_undo_moves_back_to_todo(config, root):
    add("one", config, TODAY)
    mark_done(1, "one", config, NEXT_DAY)
    t = undo(1, "one", config)
    assert t["done"] is False and t["finished"] == ""
    assert texts(config, done=False) == ["one"] and texts(config, done=True) == []
    assert "\n\n\n" not in (root / "INBOX.md").read_text()


def test_emptied_section_keeps_single_blank_lines(config, root):
    add("one", config, TODAY)
    mark_done(1, "one", config, NEXT_DAY)
    assert "## To do\n\n## Done\n\n- [x]" in (root / "INBOX.md").read_text()


def test_refuses_when_expected_text_no_longer_matches(config, root):
    add("one", config, TODAY)
    before = (root / "INBOX.md").read_text()
    with pytest.raises(HeaderError, match="changed"):
        mark_done(1, "other", config, NEXT_DAY)
    with pytest.raises(HeaderError):
        delete(7, None, config)
    assert (root / "INBOX.md").read_text() == before


def test_delete(config):
    add("one", config, TODAY)
    add("two", config, TODAY)
    delete(1, "one", config)
    assert texts(config) == ["two"]


def test_hand_written_lines_and_free_text_are_kept(config, root):
    write(root / "INBOX.md", "# Mine\n\nfree note\n\n## To do\n\n- [ ] no date\n- [X] done by hand\n")
    assert list_todos(config) == [
        {"n": 1, "done": False, "added": "", "finished": "", "text": "no date"},
        {"n": 2, "done": True, "added": "", "finished": "", "text": "done by hand"},
    ]
    mark_done(1, "no date", config, NEXT_DAY)
    text = (root / "INBOX.md").read_text()
    assert text.startswith("# Mine\n\nfree note\n")
    assert "## Done\n\n- [x] → 2026-09-29 · no date\n" in text


def test_promote_creates_the_folder_and_removes_the_line(config):
    add("Redo the pricing page", config, TODAY)
    f = promote(1, "Redo the pricing page", "pricing-page", config, today=TODAY)
    assert f.path == "projects/pricing-page" and f.summary == "Redo the pricing page"
    assert list_todos(config) == []


def test_promote_into_another_collection(config):
    add("Study churn", config, TODAY)
    assert promote(1, None, "churn", config, "research", TODAY).path == "research/churn"


def test_refused_promote_leaves_the_inbox_alone(config):
    add("x", config, TODAY)
    with pytest.raises(HeaderError):
        promote(1, "x", "alpha", config, today=TODAY)
    assert texts(config) == ["x"]


def test_cli(root):
    write(root / "cockpit.toml", "")

    def cli(*args):
        r = subprocess.run([sys.executable, "-m", "cockpit", "--config", str(root / "cockpit.toml"), "todo", *args],
                           capture_output=True, text=True, cwd=REPO)
        return r.returncode, json.loads(r.stdout)
    assert cli("add", "--", "-3 tickets")[1]["text"] == "-3 tickets"
    assert cli()[1][0]["text"] == "-3 tickets"
    code, out = cli("done", "1", "--expected=other")
    assert code == 1 and "changed" in out["error"]
    assert cli("done", "1", "--expected=-3 tickets")[1]["done"] is True
    assert cli("promote", "1", "tickets")[1]["path"] == "projects/tickets"
