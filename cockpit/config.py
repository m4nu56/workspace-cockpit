"""Configuration: an optional cockpit.toml next to the workspace it describes."""
from __future__ import annotations

import os
import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

TERMINALS = ("iterm", "terminal", "none")
SIMPLE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
KNOWN_KEYS = {"root", "collections", "archive_dir", "header_file", "stale_after_days", "due_soon_days",
              "terminal", "editor_app", "agent_command", "port", "write_index", "inbox_file", "skill_dirs"}


class ConfigError(Exception):
    """Invalid or unreadable configuration."""


@dataclass(frozen=True)
class Collection:
    dir: str
    label: str = ""

    def __post_init__(self) -> None:
        if not self.label:
            object.__setattr__(self, "label", self.dir)


@dataclass(frozen=True)
class Config:
    root: Path
    collections: tuple[Collection, ...] = (Collection("projects", "project"),)
    archive_dir: str = "_archive"
    header_file: str = "CLAUDE.md"
    stale_after_days: int = 14
    due_soon_days: int = 7
    terminal: str = "iterm"
    editor_app: str = "Visual Studio Code"
    agent_command: str = "claude"
    port: int = 8766
    write_index: bool = False
    inbox_file: str = "INBOX.md"
    # Extra folders whose .claude/skills the Skills tab lists (e.g. a code repository that is not a tracked folder).
    skill_dirs: tuple[Path, ...] = ()
    source: Path | None = field(default=None, compare=False)

    def collection(self, dir_name: str) -> Collection | None:
        return next((c for c in self.collections if c.dir == dir_name), None)


def _find(explicit: Path | None) -> Path | None:
    if explicit is not None:
        if not explicit.is_file():
            raise ConfigError(f"Config file not found: {explicit}")
        return explicit
    env = os.environ.get("COCKPIT_CONFIG")
    if env:
        if not Path(env).expanduser().is_file():
            raise ConfigError(f"COCKPIT_CONFIG points to a missing file: {env}")
        return Path(env).expanduser()
    local = Path.cwd() / "cockpit.toml"
    return local if local.is_file() else None


def _positive_int(data: dict, key: str, default: int) -> int:
    value = data.get(key, default)
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ConfigError(f"{key} must be a positive integer")
    return value


def _string(data: dict, key: str, default: str, allow_empty: bool = False) -> str:
    value = data.get(key, default)
    if not isinstance(value, str) or (not value.strip() and not allow_empty):
        raise ConfigError(f"{key} must be a {'string' if allow_empty else 'non-empty string'}")
    return value


def load_config(path: Path | None = None) -> Config:
    """--config path, else $COCKPIT_CONFIG, else ./cockpit.toml, else defaults rooted at the current directory."""
    found = _find(path)
    if found is None:
        return Config(root=Path.cwd().resolve())
    try:
        data = tomllib.loads(found.read_text())
    except (OSError, tomllib.TOMLDecodeError) as e:
        raise ConfigError(f"Cannot read {found}: {e}") from None
    unknown = set(data) - KNOWN_KEYS
    if unknown:
        raise ConfigError(f"Unknown keys in {found.name}: {', '.join(sorted(unknown))}")

    root_value = _string(data, "root", ".")
    root = Path(root_value).expanduser()
    if not root.is_absolute():
        root = found.parent / root
    root = root.resolve()
    if not root.is_dir():
        raise ConfigError(f"root is not a directory: {root}")

    archive_dir = _string(data, "archive_dir", "_archive")
    # Starting with "_" keeps it out of the tracked folders; a plain name keeps archived folders inside the collection.
    if not archive_dir.startswith("_") or not SIMPLE_NAME.fullmatch(archive_dir.lstrip("_") or "-"):
        raise ConfigError('archive_dir must be a plain folder name starting with "_" (e.g. "_archive")')
    raw = data.get("collections", [{"dir": "projects", "label": "project"}])
    if not isinstance(raw, list) or not raw:
        raise ConfigError("collections must be a non-empty list of { dir, label }")
    collections: list[Collection] = []
    for item in raw:
        if not isinstance(item, dict) or not isinstance(item.get("dir"), str) or not SIMPLE_NAME.fullmatch(item["dir"]):
            raise ConfigError(f"Invalid collection (dir must be a plain folder name): {item!r}")
        if item["dir"] in (archive_dir, "_archive") or item["dir"] in [c.dir for c in collections]:
            raise ConfigError(f"Invalid or duplicate collection: {item['dir']}")
        label = item.get("label", item["dir"])
        if not isinstance(label, str) or not label.strip():
            raise ConfigError(f"Invalid label for collection {item['dir']}")
        collections.append(Collection(item["dir"], label))

    terminal = _string(data, "terminal", "iterm")
    if terminal not in TERMINALS:
        raise ConfigError(f"terminal must be one of: {', '.join(TERMINALS)}")
    header_file = _string(data, "header_file", "CLAUDE.md")
    if not SIMPLE_NAME.fullmatch(header_file):
        raise ConfigError("header_file must be a plain file name")
    inbox_file = _string(data, "inbox_file", "INBOX.md")
    if not SIMPLE_NAME.fullmatch(inbox_file):
        raise ConfigError("inbox_file must be a plain file name (it lives at the workspace root)")
    write_index = data.get("write_index", False)
    if not isinstance(write_index, bool):
        raise ConfigError("write_index must be true or false")
    raw_skill_dirs = data.get("skill_dirs", [])
    if not isinstance(raw_skill_dirs, list) or not all(isinstance(d, str) and d.strip() for d in raw_skill_dirs):
        raise ConfigError("skill_dirs must be a list of folder paths")
    skill_dirs = tuple((root / Path(d).expanduser()).resolve() for d in raw_skill_dirs)
    return Config(
        root=root, collections=tuple(collections), archive_dir=archive_dir, header_file=header_file,
        stale_after_days=_positive_int(data, "stale_after_days", 14), due_soon_days=_positive_int(data, "due_soon_days", 7),
        terminal=terminal, editor_app=_string(data, "editor_app", "Visual Studio Code", allow_empty=True),
        agent_command=_string(data, "agent_command", "claude"), port=_positive_int(data, "port", 8766),
        write_index=write_index, inbox_file=inbox_file, skill_dirs=skill_dirs, source=found,
    )
