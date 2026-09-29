"""Inbox: small to-dos that do not deserve a folder, kept in a Markdown checklist at the workspace root.

One line per to-do (`- [ ] 2026-09-29 · Call the vendor`), under a "## To do" and a "## Done" section.
Everything else in the file (title, notes written by hand) is kept as is. A to-do is addressed by its
rank in the file (1 = first); callers can pass the text they expect to find there, so that an action
on a file edited in the meantime is refused instead of hitting the wrong line.
"""
from __future__ import annotations

import datetime as dt
import re
from pathlib import Path

from .config import Config
from .workspace import MAX_LENGTH, Folder, HeaderError, create

OPEN_TITLE = "## To do"
DONE_TITLE = "## Done"
TODO_LINE = re.compile(r"^- \[([ xX])\] (?:(\d{4}-\d{2}-\d{2}) )?(?:→ (\d{4}-\d{2}-\d{2}) )?(?:· )?(.*)$")
TEMPLATE = ["# Inbox", "",
            "Small to-dos that do not deserve a folder. Managed by the cockpit and `bin/cockpit todo`;"
            " safe to edit by hand.", "", OPEN_TITLE, "", DONE_TITLE, ""]


def _path(config: Config) -> Path:
    return config.root / config.inbox_file


def _parse(line: str, n: int) -> dict | None:
    m = TODO_LINE.match(line)
    if not m:
        return None
    return {"n": n, "done": m.group(1) != " ", "added": m.group(2) or "", "finished": m.group(3) or "",
            "text": m.group(4).strip()}


def _format(t: dict) -> str:
    dates = " ".join(x for x in (t["added"], f"→ {t['finished']}" if t["done"] and t["finished"] else "") if x)
    return f"- [{'x' if t['done'] else ' '}] " + (f"{dates} · " if dates else "") + t["text"]


def _read(config: Config) -> list[str]:
    path = _path(config)
    lines = path.read_text().splitlines() if path.exists() else list(TEMPLATE)
    for title in (OPEN_TITLE, DONE_TITLE):
        if title not in (line.strip() for line in lines):
            lines += ["", title, ""]
    return lines


def _write(lines: list[str], config: Config) -> None:
    # Moving lines around leaves runs of blank lines: keep one.
    lines[:] = [line for i, line in enumerate(lines) if line.strip() or (i and lines[i - 1].strip())]
    while lines and not lines[-1].strip():
        lines.pop()
    _path(config).write_text("\n".join(lines) + "\n")


def _todos(lines: list[str]) -> list[tuple[int, dict]]:
    """(line index, to-do) in file order."""
    found: list[tuple[int, dict]] = []
    for i, line in enumerate(lines):
        t = _parse(line, len(found) + 1)
        if t:
            found.append((i, t))
    return found


def _find(lines: list[str], n: int, expected: str | None) -> tuple[int, dict]:
    todos = _todos(lines)
    if not 1 <= n <= len(todos):
        raise HeaderError(f"No to-do #{n}")
    i, t = todos[n - 1]
    if expected is not None and t["text"] != expected.strip():
        raise HeaderError("The inbox changed in the meantime: reload the page")
    return i, t


def _insert(lines: list[str], title: str, line: str, at_top: bool) -> None:
    h = next(i for i, x in enumerate(lines) if x.strip() == title)
    end = next((i for i in range(h + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    items = [i for i in range(h + 1, end) if TODO_LINE.match(lines[i])]
    if items:
        lines.insert(items[0] if at_top else items[-1] + 1, line)
        return
    pos = h + 1
    if pos < len(lines) and not lines[pos].strip():
        pos += 1
    else:
        lines.insert(pos, "")
        pos += 1
    lines.insert(pos, line)
    if pos + 1 < len(lines) and lines[pos + 1].strip():
        lines.insert(pos + 1, "")


def _clean_text(text: str) -> str:
    if "\n" in text or "\r" in text:
        raise HeaderError("One line only")
    text = text.strip()[:MAX_LENGTH].strip()
    if not text:
        raise HeaderError("Empty to-do")
    return text


def _numbered(lines: list[str], line: str) -> dict:
    return next(t for i, t in _todos(lines) if lines[i] == line)


def list_todos(config: Config) -> list[dict]:
    if not _path(config).exists():
        return []
    return [t for _, t in _todos(_read(config))]


def add(text: str, config: Config, today: dt.date | None = None) -> dict:
    t = {"done": False, "added": (today or dt.date.today()).isoformat(), "finished": "", "text": _clean_text(text)}
    lines = _read(config)
    _insert(lines, OPEN_TITLE, _format(t), at_top=False)
    _write(lines, config)
    return _numbered(lines, _format(t))


def _toggle(n: int, expected: str | None, done: bool, config: Config, today: dt.date | None) -> dict:
    lines = _read(config)
    i, t = _find(lines, n, expected)
    if t["done"] == done:
        raise HeaderError("Already done" if done else "Not done yet")
    t = {**t, "done": done, "finished": (today or dt.date.today()).isoformat() if done else ""}
    del lines[i]
    _insert(lines, DONE_TITLE if done else OPEN_TITLE, _format(t), at_top=done)
    _write(lines, config)
    return _numbered(lines, _format(t))


def mark_done(n: int, expected: str | None, config: Config, today: dt.date | None = None) -> dict:
    return _toggle(n, expected, True, config, today)


def undo(n: int, expected: str | None, config: Config) -> dict:
    return _toggle(n, expected, False, config, None)


def delete(n: int, expected: str | None, config: Config) -> dict:
    lines = _read(config)
    i, t = _find(lines, n, expected)
    del lines[i]
    _write(lines, config)
    return t


def promote(n: int, expected: str | None, name: str, config: Config, collection: str | None = None,
            today: dt.date | None = None) -> Folder:
    """The to-do becomes a folder (its text is the summary) and leaves the inbox; nothing is removed if creation fails."""
    lines = _read(config)
    i, t = _find(lines, n, expected)
    folder = create(collection or config.collections[0].dir, name, t["text"], config, today)
    del lines[i]
    _write(lines, config)
    return folder
