"""Claude Code skills available around the workspace, for the Skills tab (read-only).

Sources, in display order:
    workspace        <root>/.claude/skills/<name>/SKILL.md
    folder:<path>    <tracked folder>/.claude/skills/... (archived folders skipped)
    dir:<path>       <skill_dirs entry>/.claude/skills/... (cockpit.toml)
    personal         <claude config>/skills/... (synced/ excluded)
    claude-ai        <claude config>/skills/synced/<account>/<name>/SKILL.md (skills synced from claude.ai)
    plugin:<name>    <installPath>/skills/... of the plugins enabled in <claude config>/settings.json

Short summary: the `summary:` frontmatter field (Claude Code only reads name and description, so it is ignored there),
else the first sentence of the description (summary_auto = true).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from .config import Config
from .workspace import list_folders

SUMMARY_MAX = 200
MAX_FILES = 50
SENTENCE_END = re.compile(r"[.!?](?=\s|$)")
KEY_LINE = re.compile(r"^([A-Za-z0-9_-]+):(?:\s+(.*))?$")
BLOCK_SCALAR = re.compile(r"^[|>][+-]?\d*$")


def first_sentence(text: str) -> str:
    """First sentence of a description, capped so a long trigger text stays a one-liner."""
    text = " ".join(text.split())
    end = SENTENCE_END.search(text)
    sentence = text[: end.end()] if end else text
    return sentence if len(sentence) <= SUMMARY_MAX else sentence[: SUMMARY_MAX - 1].rstrip() + "…"


def _unquote(value: str) -> str | None:
    """Value of a quoted scalar, None when the quote is not closed on the line."""
    quote = value[0]
    if len(value) < 2 or not value.endswith(quote):
        return None
    inner = value[1:-1]
    if quote == "'":
        return inner.replace("''", "'")
    return re.sub(r'\\(["\\nt])', lambda m: {"n": "\n", "t": "\t"}.get(m.group(1), m.group(1)), inner)


def _parse_fields(lines: list[str]) -> dict[str, str]:
    """The subset of YAML that skill headers use: `key: value`, quoted values, block scalars (| >), indented
    continuations. Nested structures (lists, maps) are kept as an empty string. Raises ValueError otherwise."""
    fields: dict[str, str] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        match = KEY_LINE.match(line)
        if not match:
            raise ValueError(f"unexpected line: {line.strip()[:60]}")
        key, value = match.group(1), (match.group(2) or "").strip()
        i += 1
        continuation: list[str] = []
        while i < len(lines) and (not lines[i].strip() or lines[i][:1] in (" ", "\t")):
            continuation.append(lines[i].strip())
            i += 1
        while continuation and not continuation[-1]:
            continuation.pop()
        if BLOCK_SCALAR.match(value):
            separator = "\n" if value.startswith("|") else " "
            fields[key] = separator.join(continuation).strip()
        elif value[:1] in ('"', "'"):
            unquoted = _unquote(" ".join([value, *continuation]).strip())
            if unquoted is None:
                raise ValueError(f"unclosed quote in {key}")
            fields[key] = unquoted
        elif value[:1] in ("[", "{"):
            if not value.endswith(("]", "}")):
                raise ValueError(f"unclosed flow value in {key}")
            fields[key] = ""
        elif not value:
            # A nested list or map: not a text field.
            fields[key] = ""
        else:
            fields[key] = " ".join([value, *continuation]).strip()
    return fields


def parse_frontmatter(text: str) -> tuple[dict[str, str], str, str | None]:
    """(fields, body, error). A broken header yields an error, never an exception."""
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return {}, text, "no frontmatter"
    for end, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            body = "".join(lines[end + 1:])
            try:
                return _parse_fields([l.rstrip("\r\n") for l in lines[1:end]]), body, None
            except ValueError as e:
                return {}, body, f"invalid frontmatter: {e}"
    return {}, text, "no frontmatter"


def _read(skill_md: Path) -> tuple[dict[str, str], str, str | None]:
    try:
        return parse_frontmatter(skill_md.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError) as e:
        return {}, "", f"unreadable: {e}"


def _files(folder: Path) -> list[str]:
    """Supporting files of a skill (references, scripts), relative to its folder."""
    found = sorted(
        p.relative_to(folder).as_posix() for p in folder.rglob("*")
        if p.is_file() and p.name not in ("SKILL.md", ".DS_Store") and "__pycache__" not in p.parts
    )
    return found[:MAX_FILES]


def _one_line(value: str) -> str:
    return " ".join(value.split())


def _skill(folder: Path, origin: str, prefix: str) -> dict:
    fields, _, error = _read(folder / "SKILL.md")
    description = _one_line(fields.get("description", ""))
    summary = _one_line(fields.get("summary", ""))
    return {
        "id": f"{origin}/{folder.name}",
        "name": prefix + (_one_line(fields.get("name", "")) or folder.name),
        "origin": origin,
        "summary": summary or first_sentence(description),
        "summary_auto": not summary,
        "description": description,
        "path": str(folder / "SKILL.md"),
        "files": _files(folder),
        "error": error,
        "duplicate": False,
    }


def _skill_folders(base: Path) -> list[Path]:
    if not base.is_dir():
        return []
    return sorted(p for p in base.iterdir() if (p / "SKILL.md").is_file())


def _subfolders(base: Path) -> list[Path]:
    return sorted(p for p in base.iterdir() if p.is_dir()) if base.is_dir() else []


def _json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _enabled_plugins(claude: Path) -> list[tuple[str, Path]]:
    """(plugin name, install path) of the plugins enabled in settings.json, as Claude Code loads them."""
    enabled = _json(claude / "settings.json").get("enabledPlugins", {})
    installed = _json(claude / "plugins" / "installed_plugins.json").get("plugins", {})
    plugins = []
    for key, on in sorted(enabled.items()):
        installs = installed.get(key) or []
        if on and installs and isinstance(installs[0], dict) and installs[0].get("installPath"):
            plugins.append((key.split("@")[0], Path(installs[0]["installPath"])))
    return plugins


def _relative(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)


def _sources(config: Config, claude: Path) -> list[tuple[str, str, list[Path], str]]:
    """(origin, label, skill folders, name prefix) in display order."""
    root = config.root
    sources = [("workspace", "Workspace", _skill_folders(root / ".claude" / "skills"), "")]
    for folder in sorted(list_folders(config), key=lambda f: f.path):
        if not folder.archived:
            sources.append((f"folder:{folder.path}", folder.path, _skill_folders(root / folder.path / ".claude" / "skills"), ""))
    for extra in config.skill_dirs:
        name = _relative(extra, root)
        sources.append((f"dir:{name}", name, _skill_folders(extra / ".claude" / "skills"), ""))
    personal = claude / "skills"
    synced = [s for account in _subfolders(personal / "synced") for s in _skill_folders(account)]
    sources.append(("personal", "Personal", [s for s in _skill_folders(personal) if s.name != "synced"], ""))
    sources.append(("claude-ai", "Synced from claude.ai", synced, "anthropic-skills:"))
    for name, install in _enabled_plugins(claude):
        sources.append((f"plugin:{name}", f"Plugin {name}", _skill_folders(install / "skills"), f"{name}:"))
    return sources


def list_skills(config: Config, claude: Path) -> list[dict]:
    groups = [
        {"origin": origin, "label": label, "skills": [_skill(f, origin, prefix) for f in folders]}
        for origin, label, folders, prefix in _sources(config, claude)
    ]
    groups = [g for g in groups if g["skills"]]
    # The same name in two sources: Claude Code lists both, which one triggers is ambiguous.
    counts: dict[str, int] = {}
    for group in groups:
        for s in group["skills"]:
            counts[s["name"]] = counts.get(s["name"], 0) + 1
    for group in groups:
        for s in group["skills"]:
            s["duplicate"] = counts[s["name"]] > 1
    return groups


def skill_detail(skill_id: str, config: Config, claude: Path) -> dict:
    """One skill with its SKILL.md body (frontmatter stripped)."""
    for group in list_skills(config, claude):
        for s in group["skills"]:
            if s["id"] == skill_id:
                _, body, _ = _read(Path(s["path"]))
                return {**s, "group": group["label"], "body": body}
    raise LookupError(f"Unknown skill: {skill_id}")
