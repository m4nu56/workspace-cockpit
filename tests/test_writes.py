import json
import subprocess
import sys
from pathlib import Path

import pytest
from conftest import TODAY, write
from cockpit.config import Config
from cockpit.workspace import HeaderError, apply, archive, create, load, set_header, unarchive

REPO = Path(__file__).resolve().parent.parent


def test_set_header_stamps_updated_and_keeps_body(config, root):
    d = set_header("projects/alpha", {"waiting_on": "someone", "who": "Vendor"}, config, TODAY)
    text = (root / "projects/alpha/CLAUDE.md").read_text()
    assert d.waiting_on == "someone" and d.who == "Vendor" and d.updated == "2026-09-28"
    assert text.split("---\n", 2)[2] == "# Alpha\n" and "custom_key: x" in text


def test_set_header_refuses_without_writing(config, root):
    before = (root / "projects/beta/CLAUDE.md").read_text()
    with pytest.raises(HeaderError):
        set_header("projects/beta", {"waiting_on": "me", "status": "finished"}, config, TODAY)
    assert (root / "projects/beta/CLAUDE.md").read_text() == before


def test_set_header_creates_the_file(config, root):
    set_header("projects/gamma", {"status": "active", "summary": "Gamma"}, config, TODAY)
    assert (root / "projects/gamma/CLAUDE.md").read_text().startswith("---\nstatus: active\nsummary: Gamma\nupdated: 2026-09-28\n---\n")


def test_archive_then_unarchive(config, root):
    d = archive("projects/alpha", config, TODAY)
    assert d.path == "projects/_archive/2026/alpha" and d.status == "done" and not (root / "projects/alpha").exists()
    d = unarchive(d.path, config, TODAY)
    assert d.path == "projects/alpha" and d.status == "paused"


def test_archive_collision_changes_nothing(config, root):
    write(root / "projects/_archive/2026/alpha/CLAUDE.md", "x")
    before = (root / "projects/alpha/CLAUDE.md").read_text()
    with pytest.raises(HeaderError):
        archive("projects/alpha", config, TODAY)
    assert (root / "projects/alpha/CLAUDE.md").read_text() == before


def test_unarchive_moves_nothing_when_header_refused(config, root):
    write(root / "projects/_archive/2026/broken/CLAUDE.md", "---\nstatus: done\n# unclosed\n")
    with pytest.raises(HeaderError):
        unarchive("projects/_archive/2026/broken", config, TODAY)
    assert (root / "projects/_archive/2026/broken").exists() and not (root / "projects/broken").exists()


def test_archive_refuses_archived(config):
    with pytest.raises(HeaderError):
        archive("projects/_archive/2026/old", config, TODAY)


def test_create(config, root):
    d = create("research", "market-study", "A study", config, TODAY)
    assert d.path == "research/market-study" and d.status == "active" and d.waiting_on == "me"
    assert "# market-study" in (root / "research/market-study/CLAUDE.md").read_text()


@pytest.mark.parametrize("name", ["Alpha", "a", "../x", "a b", "old", "alpha", "-x"])
def test_create_refuses(config, name):
    with pytest.raises(HeaderError):
        create("projects", name, "S", config, TODAY)


def test_create_refuses_unknown_collection(config):
    with pytest.raises(HeaderError):
        create("notes", "x-y", "S", config, TODAY)


def test_apply(config, tmp_path):
    tsv = tmp_path / "p.tsv"
    tsv.write_text("path\tstatus\tsummary\tnext_step\twaiting_on\twho\tdue\n"
                   "projects/beta\t\t\tCall\tsomeone\tVendor\t2026-10-01\n"
                   "projects/gamma\tactive\tGamma\t\tme\t\t\n"
                   "projects/missing\tactive\tX\t\t\t\t\n")
    r = apply(tsv, config, TODAY)
    assert r["applied"] == 2 and r["errors"][0]["path"] == "projects/missing"
    beta = load("projects/beta", config, TODAY)
    assert beta.summary == "Beta" and beta.next_step == "Call" and beta.due == "2026-10-01"


def test_index_written_only_when_enabled(root):
    set_header("projects/beta", {"next_step": "x"}, Config(root=root), TODAY)
    assert not (root / "INDEX.md").exists()
    set_header("projects/beta", {"next_step": "y"}, Config(root=root, write_index=True), TODAY)
    assert (root / "INDEX.md").exists()


def run_cli(root: Path, *args: str) -> subprocess.CompletedProcess:
    cfg = root / "cockpit.toml"
    cfg.write_text('collections = [{ dir = "projects", label = "project" }, { dir = "research" }]\n')
    return subprocess.run([sys.executable, "-m", "cockpit", "--config", str(cfg), *args],
                          capture_output=True, text=True, cwd=REPO)


def test_cli_json_and_errors(root):
    ok = run_cli(root, "list")
    assert ok.returncode == 0 and len(json.loads(ok.stdout)) == 5
    ko = run_cli(root, "show", "bin")
    assert ko.returncode == 1 and "error" in json.loads(ko.stdout)
    r = run_cli(root, "header", "projects/beta", "--set", "next_step=A = B")
    assert r.returncode == 0 and json.loads(r.stdout)["next_step"] == "A = B"
    c = run_cli(root, "config")
    assert json.loads(c.stdout)["collections"][1] == {"dir": "research", "label": "research"}


def test_cli_values_starting_with_a_dash(root):
    r = run_cli(root, "new", "projects", "dash-test", "--summary=-v2 of the thing")
    assert r.returncode == 0, r.stdout + r.stderr
    assert json.loads(r.stdout)["summary"] == "-v2 of the thing"
    s = run_cli(root, "search", "--", "-v2")
    assert s.returncode == 0 and json.loads(s.stdout)["results"]


def test_cli_bad_config(tmp_path):
    cfg = tmp_path / "cockpit.toml"
    cfg.write_text('terminal = "kitty"\n')
    r = subprocess.run([sys.executable, "-m", "cockpit", "--config", str(cfg), "list"], capture_output=True, text=True, cwd=REPO)
    assert r.returncode == 1 and "terminal" in json.loads(r.stdout)["error"]
