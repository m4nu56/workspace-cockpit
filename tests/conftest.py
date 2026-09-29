import datetime as dt
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cockpit.config import Config, Collection  # noqa: E402

TODAY = dt.date(2026, 9, 28)


def write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return path


@pytest.fixture
def root(tmp_path: Path) -> Path:
    write(tmp_path / "projects/alpha/CLAUDE.md",
          "---\nstatus: active\nsummary: Alpha\nwaiting_on: me\ncustom_key: x\nupdated: 2026-09-27\n---\n# Alpha\n")
    write(tmp_path / "projects/beta/CLAUDE.md", "---\nstatus: paused\nsummary: Beta\ndue: 2026-09-30\n---\n")
    write(tmp_path / "projects/gamma/notes.md", "nothing\n")
    write(tmp_path / "projects/_archive/2026/old/CLAUDE.md", "---\nstatus: done\nsummary: Old\n---\n")
    write(tmp_path / "research/CLAUDE.md", "# research\n")
    write(tmp_path / "research/logs/report.md", "Café opening report\n")
    (tmp_path / "projects/alpha/node_modules/x").mkdir(parents=True)
    write(tmp_path / "projects/alpha/node_modules/x/y.js", "")
    return tmp_path


@pytest.fixture
def config(root: Path) -> Config:
    return Config(root=root, collections=(Collection("projects", "project"), Collection("research", "research")))
