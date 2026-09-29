import os
import runpy
import sys
from pathlib import Path

from cockpit.config import load_config
from cockpit.sessions import list_sessions
from cockpit.workspace import list_folders

DEMO = Path(__file__).resolve().parent.parent / "examples" / "make-demo.py"


def test_demo_covers_every_state(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "argv", ["make-demo.py", "--out", str(tmp_path)])
    runpy.run_path(str(DEMO), run_name="__main__")
    config = load_config(tmp_path / "demo-workspace" / "cockpit.toml")
    folders = {f.name: f for f in list_folders(config)}
    assert len(folders) == 9
    alerts = {a for f in folders.values() for a in f.alerts}
    assert {"no_status", "stale_header", "overdue", "due_soon"} <= alerts
    assert folders["legacy-api-shutdown"].archived and folders["pricing-study"].collection == "research"
    sessions = list_sessions(tmp_path / "demo-claude", str(config.root))
    assert len(sessions) == 7 and sum(s["open"] for s in sessions) == 2
    assert {s["folder"] for s in sessions} >= {"", "projects/website-redesign", "research/user-interviews"}
