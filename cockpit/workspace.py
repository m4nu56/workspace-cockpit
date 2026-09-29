"""Workspace rules: folder headers, inventory, alerts, archive, creation, search, calendar.

A tracked folder is a direct child of a configured collection (e.g. projects/website-redesign) or of its
archive (projects/_archive/2026/website-redesign). Its state lives in a small header at the top of its
header file (CLAUDE.md by default), one `key: value` per line between two `---` lines.
"""
from __future__ import annotations

import csv
import datetime as dt
import os
import re
import unicodedata
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .config import Config

FIELDS = ("status", "summary", "next_step", "waiting_on", "who", "due", "updated", "created")
DATES = ("due", "updated", "created")
REQUIRED = ("status", "summary")
STATUSES = ("active", "paused", "done")
WAITING = ("me", "someone", "nobody")
MAX_LENGTH = 300
PRUNED = {".git", "node_modules", "__pycache__", ".next", "venv", ".venv", "dist", "build"}
IGNORED_FILES = {".DS_Store"}
MAX_FILES = 2000
VALID_NAME = re.compile(r"^[a-z0-9][a-z0-9-]{1,60}$")
TEXT_EXTENSIONS = {".md", ".txt", ".sql", ".csv", ".html"}
MAX_SEARCH_SIZE = 2 * 1024 * 1024
MAX_RESULTS = 200
MAX_PER_FILE = 3


class HeaderError(Exception):
    """A refusal explained to the user (CLI output: {"error": ...})."""


# --- Header -----------------------------------------------------------------------------------------

def _strip_eol(line: str) -> str:
    return line.rstrip("\r\n")


def _closing_line(lines: list[str]) -> int | None:
    """Index of the closing '---', or None when there is no closed header."""
    if not lines or _strip_eol(lines[0]).strip() != "---":
        return None
    for i in range(1, len(lines)):
        if _strip_eol(lines[i]).strip() == "---":
            return i
    return None


def read_header(text: str) -> tuple[dict[str, str], bool]:
    lines = text.splitlines(keepends=True)
    end = _closing_line(lines)
    if end is None:
        return {}, False
    fields: dict[str, str] = {}
    for line in lines[1:end]:
        key, sep, value = _strip_eol(line).partition(":")
        if sep and key.strip() and not key.startswith(" "):
            fields[key.strip()] = value.strip()
    return fields, True


def is_date(value: str) -> bool:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        dt.date.fromisoformat(value)
    except ValueError:
        return False
    return True


def validate(key: str, value: str) -> str:
    """Cleaned value, or HeaderError. '' means "remove the field" (not allowed for status and summary)."""
    if key not in FIELDS:
        raise HeaderError(f"Unknown field: {key}")
    if "\n" in value or "\r" in value:
        raise HeaderError(f"{key}: a single line is expected")
    value = value.strip()[:MAX_LENGTH].strip()
    if value == "---":
        raise HeaderError(f"{key}: forbidden value")
    if not value:
        if key in REQUIRED:
            raise HeaderError(f"{key} is required")
        return ""
    if key == "status" and value not in STATUSES:
        raise HeaderError(f"status: {' | '.join(STATUSES)}")
    if key == "waiting_on" and value not in WAITING:
        raise HeaderError(f"waiting_on: {' | '.join(WAITING)}")
    if key in DATES and not is_date(value):
        raise HeaderError(f"{key}: YYYY-MM-DD date expected")
    return value


def _line_ending(text: str) -> str:
    crlf = text.count("\r\n")
    return "\r\n" if crlf and crlf * 2 >= text.count("\n") else "\n"


def write_header(text: str, changes: dict[str, str]) -> str:
    """Rewrites the header block only; the body is copied as is. A '' value removes the field."""
    eol = _line_ending(text)
    lines = text.splitlines(keepends=True)
    end = _closing_line(lines)
    if end is None:
        if lines and _strip_eol(lines[0]).strip() == "---":
            raise HeaderError("Unclosed header: fix the file by hand")
        old: list[str] = []
        body = eol + text
    else:
        old = lines[1:end]
        body = "".join(lines[end + 1:])
    remaining = dict(changes)
    new: list[str] = []
    for line in old:
        key = _strip_eol(line).partition(":")[0].strip()
        if key in remaining:
            value = remaining.pop(key)
            if value:
                new.append(f"{key}: {value}{eol}")
        else:
            new.append(line if line.endswith(("\n", "\r")) else line + eol)
    for key in sorted(remaining, key=lambda k: FIELDS.index(k) if k in FIELDS else len(FIELDS)):
        if remaining[key]:
            new.append(f"{key}: {remaining[key]}{eol}")
    return f"---{eol}" + "".join(new) + f"---{eol}" + body


# --- Inventory ----------------------------------------------------------------------------------------

def _walkable(name: str) -> bool:
    """Subfolders shown and searched: no dependencies/builds, no hidden folders."""
    return name not in PRUNED and not name.startswith(".")


def last_activity(base: Path) -> float:
    """mtime of the most recent file inside base (0.0 if none) -- never the folder's own mtime,
    which a .DS_Store is enough to refresh."""
    latest = 0.0
    for folder, subfolders, files in os.walk(base):
        subfolders[:] = [d for d in subfolders if d not in PRUNED]
        for name in files:
            if name in IGNORED_FILES:
                continue
            try:
                latest = max(latest, os.lstat(os.path.join(folder, name)).st_mtime)
            except OSError:
                continue
    return latest


def alerts(header: dict[str, str], archived: bool, today: dt.date, config: Config) -> list[str]:
    if archived:
        return []
    status = header.get("status", "")
    if not status:
        return ["no_status"]
    out: list[str] = []
    if status not in STATUSES or header.get("waiting_on", "me") not in WAITING or any(
            header.get(k) and not is_date(header[k]) for k in DATES):
        out.append("invalid_header")
    updated = header.get("updated", "")
    if status == "active" and (not is_date(updated) or
                               dt.date.fromisoformat(updated) < today - dt.timedelta(days=config.stale_after_days)):
        out.append("stale_header")
    due = header.get("due", "")
    if status in ("active", "paused") and is_date(due):
        day = dt.date.fromisoformat(due)
        if day < today:
            out.append("overdue")
        elif day <= today + dt.timedelta(days=config.due_soon_days):
            out.append("due_soon")
    return out


@dataclass
class Folder:
    collection: str
    label: str
    name: str
    path: str
    archived: bool
    archive_year: str | None
    header: dict[str, str] = field(default_factory=dict)
    activity: float = 0.0
    alerts: list[str] = field(default_factory=list)
    created: str = ""  # header "created" when valid, else the folder's creation date on disk

    def _field(self, key: str) -> str:
        return self.header.get(key, "")

    status = property(lambda self: self._field("status"))
    summary = property(lambda self: self._field("summary"))
    next_step = property(lambda self: self._field("next_step"))
    waiting_on = property(lambda self: self._field("waiting_on"))
    who = property(lambda self: self._field("who"))
    due = property(lambda self: self._field("due"))
    updated = property(lambda self: self._field("updated"))

    def to_dict(self) -> dict:
        d = asdict(self)
        d.update({k: self._field(k) for k in FIELDS if k != "created"})
        return d


def _read_header_file(folder: Path, config: Config) -> str | None:
    try:
        return (folder / config.header_file).read_text(errors="replace")
    except OSError:
        return None


def _creation_date(folder: Path, header: dict[str, str]) -> str:
    if is_date(header.get("created", "")):
        return header["created"]
    st = os.stat(folder)
    # st_birthtime (macOS) survives a mv; elsewhere st_ctime is the closest thing available.
    return dt.date.fromtimestamp(getattr(st, "st_birthtime", st.st_ctime)).isoformat()


def _build(folder: Path, config: Config, today: dt.date) -> Folder:
    rel = folder.relative_to(config.root)
    archived = rel.parts[1] == config.archive_dir
    text = _read_header_file(folder, config)
    header = read_header(text)[0] if text is not None else {}
    collection = config.collection(rel.parts[0])
    assert collection is not None
    return Folder(
        collection=collection.dir, label=collection.label, name=folder.name, path=rel.as_posix(), archived=archived,
        archive_year=rel.parts[2] if archived else None, header=header, activity=last_activity(folder),
        alerts=alerts(header, archived, today, config), created=_creation_date(folder, header),
    )


def _is_tracked(p: Path) -> bool:
    return p.is_dir() and not p.is_symlink() and not p.name.startswith(("_", "."))


def _candidates(config: Config):
    for c in config.collections:
        base = config.root / c.dir
        if not base.is_dir():
            continue
        yield from (p for p in base.iterdir() if _is_tracked(p))
        archive = base / config.archive_dir
        if archive.is_dir():
            for year in archive.iterdir():
                if year.is_dir() and year.name.isdigit():
                    yield from (p for p in year.iterdir() if _is_tracked(p))


def list_folders(config: Config, today: dt.date | None = None) -> list[Folder]:
    day = today or dt.date.today()
    return sorted((_build(p, config, day) for p in _candidates(config)), key=lambda f: f.activity, reverse=True)


def resolve(path: str, config: Config) -> Path:
    """Tracked folder designated by path (relative to the root), or HeaderError."""
    root = config.root
    raw = root / path
    try:
        rel = raw.resolve().relative_to(root)
    except ValueError:
        raise HeaderError(f"Path outside the workspace: {path}") from None
    parts = rel.parts
    in_collection = bool(parts) and config.collection(parts[0]) is not None
    shape_ok = in_collection and (len(parts) == 2 or (
        len(parts) == 4 and parts[1] == config.archive_dir and parts[2].isdigit()))
    if not shape_ok or not _is_tracked(raw):
        raise HeaderError(f"Not a tracked folder: {path}")
    return root / rel


def load(path: str, config: Config, today: dt.date | None = None) -> Folder:
    return _build(resolve(path, config), config, today or dt.date.today())


def show(path: str, config: Config, today: dt.date | None = None) -> dict:
    folder = load(path, config, today)
    base = config.root / folder.path
    files: list[dict] = []
    for current, subfolders, names in os.walk(base):
        subfolders[:] = sorted(d for d in subfolders if _walkable(d))
        for name in names:
            if name in IGNORED_FILES:
                continue
            p = Path(current) / name
            try:
                st = os.lstat(p)
            except OSError:
                continue
            files.append({"path": p.relative_to(base).as_posix(), "size": st.st_size, "mtime": st.st_mtime})
    files.sort(key=lambda f: f["mtime"], reverse=True)
    return {"folder": folder.to_dict(), "files": files[:MAX_FILES], "truncated": len(files) > MAX_FILES,
            "header_text": _read_header_file(base, config)}


# --- Writes -----------------------------------------------------------------------------------------

def _reindex(config: Config) -> None:
    if config.write_index:
        from .index import write_index  # lazy: index imports this module
        write_index(config)


def set_header(path: str, changes: dict[str, str], config: Config, today: dt.date | None = None,
               reindex: bool = True) -> Folder:
    day = today or dt.date.today()
    base = resolve(path, config)
    clean = {k: validate(k, v) for k, v in changes.items()}
    clean["updated"] = day.isoformat()
    target = base / config.header_file
    # surrogateescape: a non-UTF-8 byte in the body is written back unchanged.
    text = target.read_bytes().decode("utf-8", errors="surrogateescape") if target.exists() else ""
    target.write_bytes(write_header(text, clean).encode("utf-8", errors="surrogateescape"))
    if reindex:
        _reindex(config)
    return load(path, config, day)


def _move(source: Path, target: Path) -> None:
    if target.exists():
        raise HeaderError(f"Already exists: {target.name}")
    target.parent.mkdir(parents=True, exist_ok=True)
    source.rename(target)


def archive(path: str, config: Config, today: dt.date | None = None) -> Folder:
    day = today or dt.date.today()
    folder = load(path, config, day)
    if folder.archived:
        raise HeaderError("Already archived")
    target = config.root / folder.collection / config.archive_dir / str(day.year) / folder.name
    if target.exists():
        raise HeaderError(f"Already in the {day.year} archive: {folder.name}")
    set_header(path, {"status": "done"}, config, day, reindex=False)
    _move(config.root / folder.path, target)
    _reindex(config)
    return load(target.relative_to(config.root).as_posix(), config, day)


def unarchive(path: str, config: Config, today: dt.date | None = None) -> Folder:
    day = today or dt.date.today()
    folder = load(path, config, day)
    if not folder.archived:
        raise HeaderError("Not archived")
    target = config.root / folder.collection / folder.name
    if target.exists():
        raise HeaderError(f"Already exists outside the archive: {folder.name}")
    # Header first: a refused header must leave the folder where it is.
    set_header(path, {"status": "paused"}, config, day, reindex=False)
    _move(config.root / folder.path, target)
    _reindex(config)
    return load(target.relative_to(config.root).as_posix(), config, day)


def create(collection: str, name: str, summary: str, config: Config, today: dt.date | None = None) -> Folder:
    day = today or dt.date.today()
    if config.collection(collection) is None:
        raise HeaderError(f"Unknown collection: {collection}")
    if not VALID_NAME.fullmatch(name):
        raise HeaderError("Name: lowercase letters, digits and dashes (2 to 61 characters)")
    base = config.root / collection
    if (base / name).exists() or any(base.glob(f"{config.archive_dir}/*/{name}")):
        raise HeaderError(f"{name} already exists (archive included)")
    header = {"status": "active", "summary": validate("summary", summary), "waiting_on": "me", "updated": day.isoformat()}
    (base / name).mkdir(parents=True)
    (base / name / config.header_file).write_text(write_header(f"# {name}\n", header))
    _reindex(config)
    return load(f"{collection}/{name}", config, day)


def apply(tsv: Path, config: Config, today: dt.date | None = None) -> dict:
    """Applies a batch of headers (TSV: path + fields; an empty cell leaves the field unchanged)."""
    applied, errors = 0, []
    with open(tsv, newline="") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            path = (row.pop("path", "") or "").strip()
            changes = {k: v for k, v in row.items() if k in FIELDS and v and v.strip()}
            try:
                set_header(path, changes, config, today, reindex=False)
                applied += 1
            except (HeaderError, OSError) as e:
                errors.append({"path": path, "error": str(e)})
    _reindex(config)
    return {"applied": applied, "errors": errors}


# --- Search -----------------------------------------------------------------------------------------

def normalize(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c)).lower()


def search(text: str, config: Config) -> dict:
    pattern = normalize(text.strip())
    if len(pattern) < 2:
        return {"results": [], "truncated": False}
    folders = list_folders(config)
    results: list[dict] = []
    for f in folders:
        meta = " · ".join(x for x in (f.name, f.summary, f.next_step) if x)
        if pattern in normalize(meta):
            results.append({"path": f.path, "name": f.name, "file": None, "line": None, "excerpt": meta[:200]})
    for f in folders:
        base = config.root / f.path
        for current, subfolders, names in os.walk(base):
            subfolders[:] = sorted(x for x in subfolders if _walkable(x))
            for name in sorted(names):
                p = Path(current) / name
                if p.suffix.lower() not in TEXT_EXTENSIONS or p.is_symlink():
                    continue
                try:
                    if p.stat().st_size > MAX_SEARCH_SIZE:
                        continue
                    lines = p.read_text(errors="replace").splitlines()
                except OSError:
                    continue
                found = 0
                for i, line in enumerate(lines, 1):
                    if pattern in normalize(line):
                        if len(results) == MAX_RESULTS:
                            return {"results": results, "truncated": True}
                        results.append({"path": f.path, "name": f.name, "file": p.relative_to(base).as_posix(),
                                        "line": i, "excerpt": line.strip()[:200]})
                        found += 1
                        if found == MAX_PER_FILE:
                            break
    return {"results": results, "truncated": False}


# --- Calendar ---------------------------------------------------------------------------------------

def modified_days(base: Path) -> list[str]:
    """Local days (YYYY-MM-DD) on which at least one file of the folder has its modification date.
    A file modified several times only counts on its last modification."""
    days: set[str] = set()
    for current, subfolders, names in os.walk(base):
        subfolders[:] = [d for d in subfolders if _walkable(d)]
        for name in names:
            if name in IGNORED_FILES:
                continue
            try:
                days.add(dt.date.fromtimestamp(os.lstat(os.path.join(current, name)).st_mtime).isoformat())
            except OSError:
                continue
    return sorted(days)


def calendar(config: Config) -> list[dict]:
    return [{"path": f.path, "name": f.name, "collection": f.collection, "label": f.label, "archived": f.archived,
             "status": f.status, "created": f.created, "activity": f.activity, "days": modified_days(config.root / f.path)}
            for f in list_folders(config)]
