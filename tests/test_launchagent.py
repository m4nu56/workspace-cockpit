import plistlib
from pathlib import Path

import pytest
from cockpit import launchagent as la

REPO = Path("/opt/workspace-cockpit")
CONFIG = Path("/home/dev/my work/cockpit.toml")


def test_plist():
    p = la.build_plist(REPO, CONFIG, "/usr/local/bin/python3", "/opt/node/bin", Path("/tmp/wc.log"))
    assert p["Label"] == "workspace-cockpit"
    assert p["ProgramArguments"] == [str(REPO / "bin" / "cockpit"), "start"]
    assert p["RunAtLoad"] is True and p["KeepAlive"] == {"SuccessfulExit": False}
    env = p["EnvironmentVariables"]
    assert env["COCKPIT_CONFIG"] == str(CONFIG) and env["PYTHON"] == "/usr/local/bin/python3" and env["COCKPIT_NO_BROWSER"] == "1"
    assert env["PATH"].split(":")[0] == "/opt/node/bin"
    assert plistlib.loads(plistlib.dumps(p)) == p


def test_app_script_quotes_every_path():
    script = la.app_script(Path("/opt/it's \"odd\""), CONFIG, "/usr/bin/python3")
    assert script.startswith('do shell script "') and script.endswith('"')
    body = script[len('do shell script "'):-1].replace('\\"', '"').replace("\\\\", "\\")
    assert "COCKPIT_CONFIG='/home/dev/my work/cockpit.toml'" in body
    assert "'/opt/it'\"'\"'s \"odd\"/bin/cockpit' open" in body
    assert body.endswith("> /dev/null 2>&1 &")


def test_install_and_uninstall_dry(tmp_path):
    home = tmp_path / "home"
    paths = la.install(REPO, CONFIG, home=home, python="/usr/bin/python3", node_dir="/opt/node/bin", dry_run=True)
    plist = home / "Library" / "LaunchAgents" / "workspace-cockpit.plist"
    assert paths["plist"] == str(plist) and plistlib.loads(plist.read_bytes())["Label"] == "workspace-cockpit"
    assert paths["app"] == str(home / "Applications" / "Workspace Cockpit.app")
    la.uninstall(home=home, dry_run=True)
    assert not plist.exists()


def test_install_refuses_outside_macos(monkeypatch, tmp_path):
    monkeypatch.setattr(la.sys, "platform", "linux")
    with pytest.raises(la.LaunchAgentError):
        la.install(REPO, CONFIG, home=tmp_path, python="p", node_dir="n", dry_run=False)


def test_open_starts_the_agent_when_down(tmp_path):
    calls = []
    state = {"up": False}

    def run(cmd):
        calls.append(cmd[0] if cmd[0] != "launchctl" else " ".join(cmd[:2]))
        if cmd[:2] == ["launchctl", "kickstart"]:
            state["up"] = True
        return 0 if cmd[:2] != ["launchctl", "print"] else 1

    plist = tmp_path / "Library" / "LaunchAgents" / "workspace-cockpit.plist"
    plist.parent.mkdir(parents=True)
    plist.write_text("x")
    la.open_ui(8766, home=tmp_path, is_up=lambda port: state["up"], run=run, sleep=lambda s: None)
    assert calls == ["launchctl print", "launchctl bootstrap", "launchctl kickstart", "open"]


def test_open_when_already_up():
    calls = []
    la.open_ui(8766, home=Path("/nope"), is_up=lambda port: True, run=lambda c: calls.append(c) or 0, sleep=lambda s: None)
    assert calls == [["open", "http://127.0.0.1:8766"]]


def test_open_without_agent_explains(tmp_path):
    with pytest.raises(la.LaunchAgentError, match="install"):
        la.open_ui(8766, home=tmp_path, is_up=lambda port: False, run=lambda c: 0, sleep=lambda s: None)
