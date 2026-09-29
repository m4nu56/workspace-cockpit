import datetime as dt
import os

import pytest
from conftest import TODAY, write
from cockpit.config import Collection, Config
from cockpit.workspace import HeaderError, alerts, list_folders, resolve, show


def by_path(config):
    return {f.path: f for f in list_folders(config, TODAY)}


def test_inventory(config):
    f = by_path(config)
    assert set(f) == {"projects/alpha", "projects/beta", "projects/gamma", "projects/_archive/2026/old", "research/logs"}
    assert f["projects/alpha"].collection == "projects" and f["projects/alpha"].label == "project"
    assert f["research/logs"].collection == "research"
    assert f["projects/_archive/2026/old"].archived and f["projects/_archive/2026/old"].archive_year == "2026"
    assert f["projects/alpha"].waiting_on == "me"
    assert f["projects/gamma"].alerts == ["no_status"]


def test_only_configured_collections(root):
    only = Config(root=root, collections=(Collection("research"),))
    assert {f.path for f in list_folders(only, TODAY)} == {"research/logs"}


def test_activity_ignores_node_modules(config, root):
    os.utime(root / "projects/alpha/node_modules/x/y.js", (4e9, 4e9))
    assert by_path(config)["projects/alpha"].activity < 4e9


@pytest.mark.parametrize("header,expected", [
    ({"status": "active", "summary": "r", "updated": "2026-09-20"}, []),
    ({"status": "active", "summary": "r"}, ["stale_header"]),
    ({"status": "active", "summary": "r", "updated": "2026-09-13"}, ["stale_header"]),
    ({"status": "paused", "summary": "r", "due": "2026-09-27"}, ["overdue"]),
    ({"status": "paused", "summary": "r", "due": "2026-10-05"}, ["due_soon"]),
    ({"status": "paused", "summary": "r", "due": "2026-10-06"}, []),
    ({"status": "finished", "summary": "r"}, ["invalid_header"]),
    ({"status": "paused", "summary": "r", "waiting_on": "him"}, ["invalid_header"]),
    ({}, ["no_status"]),
])
def test_alerts(config, header, expected):
    assert alerts(header, False, TODAY, config) == expected


def test_no_alert_when_archived(config):
    assert alerts({"status": "done", "summary": "r", "due": "2020-01-01"}, True, TODAY, config) == []


@pytest.mark.parametrize("path", ["projects/../bin", "projects/alpha/sub", "bin", "projects/_archive",
                                  "projects/missing", "/etc", "research/CLAUDE.md", "projects/_archive/xx/old",
                                  "notes/alpha"])
def test_resolve_refuses(config, root, path):
    (root / "bin").mkdir()
    (root / "projects/alpha/sub").mkdir()
    write(root / "notes/alpha/x.md", "not a configured collection")
    with pytest.raises(HeaderError):
        resolve(path, config)


def test_resolve_refuses_symlinks(config, root, tmp_path_factory):
    (root / "projects/out").symlink_to(tmp_path_factory.mktemp("outside"))
    (root / "projects/alias").symlink_to(root / "projects/alpha")
    for p in ("projects/out", "projects/alias"):
        with pytest.raises(HeaderError):
            resolve(p, config)


def test_show(config, root):
    write(root / "projects/alpha/specs/a.md", "a")
    write(root / "projects/alpha/.hidden/x.md", "a")
    s = show("projects/alpha", config, TODAY)
    paths = [x["path"] for x in s["files"]]
    assert "specs/a.md" in paths and "CLAUDE.md" in paths
    assert not any("node_modules" in p or ".hidden" in p for p in paths)
    assert s["header_text"].startswith("---") and s["folder"]["path"] == "projects/alpha"


def test_created_from_disk_or_header(config, root):
    assert by_path(config)["projects/beta"].created == dt.date.today().isoformat()
    write(root / "projects/beta/CLAUDE.md", "---\nstatus: paused\nsummary: Beta\ncreated: 2025-01-15\n---\n")
    assert by_path(config)["projects/beta"].to_dict()["created"] == "2025-01-15"


def test_custom_header_file(root):
    write(root / "projects/alpha/README.md", "---\nstatus: paused\nsummary: From readme\n---\n")
    c = Config(root=root, header_file="README.md")
    assert {f.path: f for f in list_folders(c, TODAY)}["projects/alpha"].summary == "From readme"
