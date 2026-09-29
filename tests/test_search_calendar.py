import datetime as dt
import os

from conftest import write
from cockpit.workspace import calendar, list_folders, normalize, search


def ts(day: str) -> float:
    return dt.datetime.fromisoformat(day + "T12:00:00").timestamp()


def test_normalize():
    assert normalize("Café ÇA") == "cafe ca"


def test_accents_both_ways(config, root):
    r = search("cafe", config)["results"]
    assert any(x["path"] == "research/logs" and x["file"] == "report.md" and x["line"] == 1 for x in r)
    write(root / "projects/beta/note.txt", "a cafe without accent\n")
    assert any(x["file"] == "note.txt" for x in search("Café", config)["results"])


def test_metadata_and_archive(config):
    r = search("old", config)["results"]
    assert r[0]["path"] == "projects/_archive/2026/old" and r[0]["file"] is None


def test_ignores_extensions_big_and_hidden(config, root):
    write(root / "projects/beta/x.py", "target\n")
    write(root / "projects/beta/big.md", "target\n" + "a" * (2 * 1024 * 1024))
    write(root / "projects/beta/.cache/plan.md", "target\n")
    assert search("target", config)["results"] == []


def test_cap(config, root):
    for i in range(80):
        write(root / f"projects/beta/f{i}.md", "motif\nmotif\nmotif\nmotif\n")
    r = search("motif", config)
    assert len(r["results"]) == 200 and r["truncated"]


def test_too_short(config):
    assert search(" a ", config) == {"results": [], "truncated": False}


def test_calendar_days(config, root):
    a = write(root / "projects/alpha/a.md", "a")
    b = write(root / "projects/alpha/specs/b.md", "b")
    c = write(root / "projects/alpha/.cache/c.md", "c")
    for f, day in ((a, "2026-09-01"), (b, "2026-09-03"), (c, "2026-08-01"), (root / "projects/alpha/CLAUDE.md", "2026-09-03"),
                   (root / "projects/alpha/node_modules/x/y.js", "2026-07-01")):
        os.utime(f, (ts(day), ts(day)))
    cal = {d["path"]: d for d in calendar(config)}
    assert cal["projects/alpha"]["days"] == ["2026-09-01", "2026-09-03"]
    assert set(cal) == {d.path for d in list_folders(config)}
    assert cal["projects/_archive/2026/old"]["archived"] is True
