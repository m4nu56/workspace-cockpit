"""Command line: every command prints JSON; refusals print {"error": ...} and exit with code 1."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import index, launchagent, sessions, workspace
from .config import ConfigError, load_config


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="cockpit", description="workspace-cockpit command line (JSON output)")
    p.add_argument("--config", type=Path, help="cockpit.toml (default: $COCKPIT_CONFIG, then ./cockpit.toml)")
    sp = p.add_subparsers(dest="command", required=True)
    sp.add_parser("config", help="effective configuration")
    sp.add_parser("list", help="all tracked folders")
    sp.add_parser("show", help="one folder and its files").add_argument("path")
    h = sp.add_parser("header", help="change header fields (stamps `updated`)")
    h.add_argument("path")
    h.add_argument("--set", action="append", default=[], metavar="KEY=VALUE")
    sp.add_parser("archive", help="status done + move to <collection>/_archive/<year>/").add_argument("path")
    sp.add_parser("unarchive", help="move back out of the archive, status paused").add_argument("path")
    n = sp.add_parser("new", help="create a folder with its header")
    n.add_argument("collection")
    n.add_argument("name")
    n.add_argument("--summary", required=True)
    sp.add_parser("search", help="search names, summaries and text files").add_argument("text")
    sp.add_parser("calendar", help="creation date and modified days per folder")
    sp.add_parser("apply", help="apply a TSV of headers").add_argument("file", type=Path)
    sp.add_parser("index", help="write INDEX.md at the workspace root")
    sp.add_parser("sessions", help="Claude Code sessions started inside the workspace")
    sp.add_parser("session", help="detail of one Claude Code session").add_argument("session_id")
    sp.add_parser("install", help="macOS: start at login (LaunchAgent) + a 'Workspace Cockpit' app")
    sp.add_parser("uninstall", help="macOS: remove the LaunchAgent and the app")
    sp.add_parser("open", help="open the web UI, starting the LaunchAgent when the server is down")
    return p


def run(argv: list[str] | None = None) -> object:
    a = _parser().parse_args(argv)
    config = load_config(a.config)
    if a.command == "config":
        return {"root": str(config.root), "home": str(Path.home()), "collections": [{"dir": c.dir, "label": c.label} for c in config.collections],
                "archive_dir": config.archive_dir, "header_file": config.header_file,
                "stale_after_days": config.stale_after_days, "due_soon_days": config.due_soon_days,
                "terminal": config.terminal, "editor_app": config.editor_app, "agent_command": config.agent_command,
                "port": config.port, "write_index": config.write_index,
                "source": str(config.source) if config.source else None}
    if a.command == "list":
        return [f.to_dict() for f in workspace.list_folders(config)]
    if a.command == "show":
        return workspace.show(a.path, config)
    if a.command == "header":
        pairs = [s.partition("=") for s in a.set]
        if not pairs or any(not sep for _, sep, _ in pairs):
            raise workspace.HeaderError("--set expects KEY=VALUE")
        return workspace.set_header(a.path, {k: v for k, _, v in pairs}, config).to_dict()
    if a.command == "archive":
        return workspace.archive(a.path, config).to_dict()
    if a.command == "unarchive":
        return workspace.unarchive(a.path, config).to_dict()
    if a.command == "new":
        return workspace.create(a.collection, a.name, a.summary, config).to_dict()
    if a.command == "search":
        return workspace.search(a.text, config)
    if a.command == "calendar":
        return workspace.calendar(config)
    if a.command == "apply":
        return workspace.apply(a.file, config)
    if a.command == "index":
        return {"written": index.write_index(config)}
    if a.command == "install":
        if config.source is None:
            raise launchagent.LaunchAgentError("install needs a cockpit.toml (run it from your workspace, or pass --config)")
        return launchagent.install(Path(__file__).resolve().parent.parent, config.source.resolve())
    if a.command == "uninstall":
        return launchagent.uninstall()
    if a.command == "open":
        return launchagent.open_ui(config.port)
    if a.command == "sessions":
        return sessions.list_sessions(sessions.claude_dir(), str(config.root), sessions.CACHE)
    return sessions.session_detail(sessions.claude_dir(), str(config.root), a.session_id)


def main(argv: list[str] | None = None) -> int:
    try:
        output = run(argv)
    except (ConfigError, workspace.HeaderError, launchagent.LaunchAgentError, ValueError, LookupError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        return 1
    print(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
