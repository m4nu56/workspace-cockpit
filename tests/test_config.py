from pathlib import Path

import pytest
from cockpit.config import Collection, Config, ConfigError, load_config


def test_defaults_when_no_file(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("COCKPIT_CONFIG", raising=False)
    c = load_config(None)
    assert c.root == tmp_path.resolve()
    assert c.collections == (Collection("projects", "project"),)
    assert c.header_file == "CLAUDE.md" and c.terminal == "iterm" and c.agent_command == "claude"
    assert c.stale_after_days == 14 and c.due_soon_days == 7 and c.port == 8766 and c.write_index is False


def test_root_relative_to_the_file(tmp_path):
    (tmp_path / "w").mkdir()
    f = tmp_path / "w" / "cockpit.toml"
    f.write_text('root = "."\ncollections = [{ dir = "work", label = "job" }, { dir = "notes", label = "note" }]\n'
                 'terminal = "none"\nagent_command = "claude --model x"\n')
    c = load_config(f)
    assert c.root == (tmp_path / "w").resolve()
    assert [x.dir for x in c.collections] == ["work", "notes"]
    assert c.terminal == "none" and c.agent_command == "claude --model x"


def test_env_variable(tmp_path, monkeypatch):
    f = tmp_path / "x.toml"
    f.write_text('root = "~"\n')
    monkeypatch.setenv("COCKPIT_CONFIG", str(f))
    assert load_config(None).root == Path.home().resolve()


@pytest.mark.parametrize("content", [
    'terminal = "kitty"', 'stale_after_days = 0', 'collections = []', 'collections = [{ dir = "../x" }]',
    'collections = [{ dir = "_archive" }]', 'root = 3', 'unknown_key = 1', 'this is not toml',
    'collections = [{ dir = "a" }, { dir = "a" }]', 'root = "does-not-exist"',
])
def test_invalid(tmp_path, content):
    f = tmp_path / "cockpit.toml"
    f.write_text(content)
    with pytest.raises(ConfigError):
        load_config(f)


def test_explicit_missing_file(tmp_path):
    with pytest.raises(ConfigError):
        load_config(tmp_path / "nope.toml")


def test_label_defaults_to_dir():
    assert Config(root=Path("/"), collections=(Collection("notes"),)).collections[0].label == "notes"


@pytest.mark.parametrize("value", ["archive", "../../outside", "a/b", ""])
def test_archive_dir_must_be_a_plain_underscore_name(tmp_path, value):
    f = tmp_path / "cockpit.toml"
    f.write_text(f'archive_dir = "{value}"\n')
    with pytest.raises(ConfigError):
        load_config(f)


def test_archive_dir_custom_ok(tmp_path):
    f = tmp_path / "cockpit.toml"
    f.write_text('archive_dir = "_done"\n')
    assert load_config(f).archive_dir == "_done"
