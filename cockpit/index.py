"""INDEX.md: a Markdown map of the workspace, most recently active first. Written only on request
(`cockpit index`) or after each change when `write_index = true`."""
from __future__ import annotations

import datetime as dt
import time

from .config import Config
from .workspace import Folder, is_date, list_folders


def relative_age(ts: float, now: float) -> str:
    if ts == 0:
        return "—"
    n = int((now - ts) // 86400)
    if n <= 0:
        return "today"
    if n == 1:
        return "yesterday"
    if n < 30:
        return f"{n} days ago"
    if n < 365:
        return "1 month ago" if n < 60 else f"{n // 30} months ago"
    return "1 year ago" if n < 730 else f"{n // 365} years ago"


def _cell(text: str) -> str:
    return text.replace("|", "\\|")


def _table(folders: list[Folder], now: float) -> list[str]:
    out = ["| Last activity | | Folder | Summary | Next step |", "|---|---|---|---|---|"]
    for f in folders:
        date = time.strftime("%Y-%m-%d", time.localtime(f.activity)) if f.activity else "—"
        step = _cell(f.next_step)
        if is_date(f.due):
            step = f"{step} (due {f.due})".strip()
        out.append(f"| {date} | {relative_age(f.activity, now)} | [`{f.name}`]({f.path}/) | {_cell(f.summary)} | {step} |")
    return out


def waiting_on_me(f: Folder) -> bool:
    return not f.archived and f.status in ("active", "paused") and (
        f.waiting_on == "me" or bool({"overdue", "due_soon"} & set(f.alerts)))


def _section(lines: list[str], title: str, folders: list[Folder], now: float, text: str = "") -> None:
    if not folders:
        return
    lines += [f"## {title} ({len(folders)})", ""]
    if text:
        lines += [text, ""]
    lines += _table(folders, now) + [""]


def render_index(config: Config, now: float | None = None, today: dt.date | None = None) -> str:
    now = now or time.time()
    everything = list_folders(config, today)
    alive = [f for f in everything if not f.archived]
    lines = ["# INDEX", "",
             f"Generated on {time.strftime('%Y-%m-%d %H:%M', time.localtime(now))} by workspace-cockpit. "
             "Do not edit by hand: change the header of each folder instead.", ""]
    mine = sorted((f for f in alive if waiting_on_me(f)), key=lambda f: (f.due or "9999", -f.activity))
    _section(lines, "Waiting on me", mine, now, "`waiting_on: me`, or due date passed or within a few days.")
    for c in config.collections:
        items = [f for f in alive if f.collection == c.dir]
        _section(lines, f"{c.dir} — active", [f for f in items if f.status == "active"], now)
        _section(lines, f"{c.dir} — paused", [f for f in items if f.status == "paused"], now)
        _section(lines, f"{c.dir} — no status", [f for f in items if f.status not in ("active", "paused")], now,
                 "Missing or invalid `status`, or `done` but not archived yet.")
    archived = [f for f in everything if f.archived]
    if archived:
        lines += ["## Archive", ""]
        for year in sorted({f.archive_year or "" for f in archived}, reverse=True):
            for c in config.collections:
                items = sorted((f for f in archived if f.archive_year == year and f.collection == c.dir), key=lambda f: f.name)
                if items:
                    lines += [f"**{year} — {c.dir}** ({len(items)}) — " + " · ".join(f"[`{f.name}`]({f.path}/)" for f in items), ""]
    return "\n".join(lines) + "\n"


def write_index(config: Config, now: float | None = None, today: dt.date | None = None) -> str:
    (config.root / "INDEX.md").write_text(render_index(config, now, today))
    return str(config.root / "INDEX.md")
