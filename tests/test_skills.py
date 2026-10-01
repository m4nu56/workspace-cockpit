import dataclasses
import json
from pathlib import Path

import pytest

from cockpit.cli import main
from cockpit.skills import first_sentence, list_skills, parse_frontmatter, skill_detail
from conftest import write


def skill_md(folder: Path, header: str, body: str = "# Body\n") -> Path:
    return write(folder / "SKILL.md", f"---\n{header}---\n{body}")


@pytest.fixture
def claude(tmp_path: Path) -> Path:
    home = tmp_path / "claude-config"
    skill_md(home / "skills/deploy", "name: deploy\ndescription: Personal deploy skill.\n")
    skill_md(home / "skills/synced/acct_1/docs", "name: docs\ndescription: Editable docs.\n")
    skill_md(home / "plugins/cache/sp/skills/brainstorming", "name: brainstorming\ndescription: You MUST use this before any creative work.\n")
    skill_md(home / "plugins/cache/off/skills/hidden", "name: hidden\ndescription: Disabled plugin.\n")
    write(home / "settings.json", json.dumps({"enabledPlugins": {"superpowers@m": True, "octo@m": False}}))
    write(home / "plugins/installed_plugins.json", json.dumps({"plugins": {
        "superpowers@m": [{"installPath": str(home / "plugins/cache/sp")}],
        "octo@m": [{"installPath": str(home / "plugins/cache/off")}],
    }}))
    return home


@pytest.fixture
def skills_config(config, claude, tmp_path):
    root = config.root
    skill_md(root / ".claude/skills/release", "name: release\nsummary: Ship a release.\ndescription: >\n  Cuts a release\n  and tags it. Use whenever...\n")
    write(root / ".claude/skills/release/references/checklist.md", "x")
    skill_md(root / ".claude/skills/broken", "name: [unclosed\ndescription: \"no end\n")
    write(root / ".claude/skills/not-a-skill/notes.md", "x")
    skill_md(root / "projects/alpha/.claude/skills/alpha-report", "name: alpha-report\ndescription: Weekly report for Alpha. Use it on Mondays.\n")
    skill_md(root / "projects/_archive/2026/old/.claude/skills/gone", "name: gone\ndescription: Archived.\n")
    skill_md(tmp_path / "repo/.claude/skills/deploy", "name: deploy\ndescription: Repo deploy skill.\n")
    return dataclasses.replace(config, skill_dirs=(tmp_path / "repo",))


def by_id(groups: list[dict]) -> dict[str, dict]:
    return {s["id"]: s for g in groups for s in g["skills"]}


def test_groups_in_display_order(skills_config, claude):
    assert [g["origin"] for g in list_skills(skills_config, claude)] == [
        "workspace", "folder:projects/alpha", "dir:repo", "personal", "claude-ai", "plugin:superpowers"]


def test_explicit_summary_and_folded_description(skills_config, claude):
    s = by_id(list_skills(skills_config, claude))["workspace/release"]
    assert s["summary"] == "Ship a release."
    assert s["summary_auto"] is False
    assert s["description"] == "Cuts a release and tags it. Use whenever..."
    assert s["files"] == ["references/checklist.md"]


def test_summary_falls_back_to_first_sentence(skills_config, claude):
    s = by_id(list_skills(skills_config, claude))["folder:projects/alpha/alpha-report"]
    assert s["summary"] == "Weekly report for Alpha."
    assert s["summary_auto"] is True


def test_invalid_frontmatter_keeps_the_skill(skills_config, claude):
    s = by_id(list_skills(skills_config, claude))["workspace/broken"]
    assert s["name"] == "broken" and s["error"]


def test_archived_folders_and_folders_without_skill_md_are_skipped(skills_config, claude):
    ids = by_id(list_skills(skills_config, claude))
    assert "workspace/not-a-skill" not in ids
    assert not any("gone" in i for i in ids)


def test_duplicates_flagged(skills_config, claude):
    skills = by_id(list_skills(skills_config, claude))
    assert skills["dir:repo/deploy"]["duplicate"] and skills["personal/deploy"]["duplicate"]
    assert not skills["workspace/release"]["duplicate"]


def test_enabled_plugins_only_with_prefix(skills_config, claude):
    skills = by_id(list_skills(skills_config, claude))
    assert skills["plugin:superpowers/brainstorming"]["name"] == "superpowers:brainstorming"
    assert not any(i.startswith("plugin:octo") for i in skills)
    assert skills["claude-ai/docs"]["name"] == "anthropic-skills:docs"
    assert "personal/synced" not in skills


def test_detail_returns_body_without_frontmatter(skills_config, claude):
    d = skill_detail("workspace/release", skills_config, claude)
    assert d["body"] == "# Body\n" and d["group"] == "Workspace"
    with pytest.raises(LookupError):
        skill_detail("workspace/nope", skills_config, claude)


def test_parse_frontmatter_shapes():
    fields, body, error = parse_frontmatter(
        "---\nname: x\ndescription: |\n  line one\n  line two\nallowed-tools:\n  - Bash\nsummary: 'it''s short'\n"
        "plain: first\n  continued\nquoted: \"a \\\"b\\\"\"\n---\nbody\n")
    assert error is None and body == "body\n"
    assert fields["description"] == "line one\nline two"
    assert fields["summary"] == "it's short"
    assert fields["plain"] == "first continued"
    assert fields["quoted"] == 'a "b"'
    assert fields["allowed-tools"] == ""
    assert parse_frontmatter("# no header\n")[2] == "no frontmatter"
    assert parse_frontmatter("---\nname: x\n")[2] == "no frontmatter"
    assert parse_frontmatter("---\njust text\n---\n")[2]


def test_first_sentence():
    assert first_sentence("a" * 300).endswith("…")
    assert first_sentence("") == ""
    assert first_sentence("Opens tool v1.2 then answers. More.") == "Opens tool v1.2 then answers."


def test_cli(skills_config, claude, monkeypatch, capsys):
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(claude))
    cfg = skills_config.root / "cockpit.toml"
    write(cfg, 'collections = [ { dir = "projects" } ]\nskill_dirs = ["repo"]\n')
    assert main(["--config", str(cfg), "skills"]) == 0
    assert [g["origin"] for g in json.loads(capsys.readouterr().out)][:3] == ["workspace", "folder:projects/alpha", "dir:repo"]
    assert main(["--config", str(cfg), "skill", "workspace/nope"]) == 1
    assert "error" in json.loads(capsys.readouterr().out)
