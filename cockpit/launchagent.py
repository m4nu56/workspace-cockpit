"""macOS integration: a LaunchAgent that starts the cockpit at login (restarted only after a crash), and a
"Workspace Cockpit" app (Spotlight, Dock) that opens the page and starts the server when it is down."""
from __future__ import annotations

import os
import plistlib
import shlex
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable

LABEL = "workspace-cockpit"
APP_NAME = "Workspace Cockpit.app"
START_TIMEOUT_S = 180  # the first start after an update rebuilds the web app


class LaunchAgentError(Exception):
    """Refusal explained to the user."""


def plist_path(home: Path) -> Path:
    return home / "Library" / "LaunchAgents" / f"{LABEL}.plist"


def app_path(home: Path) -> Path:
    return home / "Applications" / APP_NAME


def build_plist(repo: Path, config: Path, python: str, node_dir: str, log: Path) -> dict:
    return {
        "Label": LABEL,
        "ProgramArguments": [str(repo / "bin" / "cockpit"), "start"],
        "WorkingDirectory": str(repo),
        "EnvironmentVariables": {
            "COCKPIT_CONFIG": str(config), "PYTHON": python, "COCKPIT_NO_BROWSER": "1",
            # launchd starts with a minimal PATH: node (and npm/npx) must be found without a shell profile.
            "PATH": f"{node_dir}:/usr/bin:/bin:/usr/sbin:/sbin",
        },
        "RunAtLoad": True,
        # `bin/cockpit start` exits 0 when a server already listens: only real failures are restarted.
        "KeepAlive": {"SuccessfulExit": False},
        "ThrottleInterval": 30,
        "StandardOutPath": str(log),
        "StandardErrorPath": str(log),
    }


def _applescript_string(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def app_script(repo: Path, config: Path, python: str) -> str:
    """AppleScript of the app: hands over to `bin/cockpit open` in the background and quits at once."""
    command = (f"COCKPIT_CONFIG={shlex.quote(str(config))} PYTHON={shlex.quote(python)} "
               f"{shlex.quote(str(repo / 'bin' / 'cockpit'))} open > /dev/null 2>&1 &")
    return f"do shell script {_applescript_string(command)}"


def _domain() -> str:
    return f"gui/{os.getuid()}"


def install(repo: Path, config: Path, home: Path | None = None, python: str | None = None,
            node_dir: str | None = None, dry_run: bool = False) -> dict:
    if sys.platform != "darwin" and not dry_run:
        raise LaunchAgentError("install is macOS only (launchd); on Linux, use a systemd user service")
    home = home or Path.home()
    python = python or sys.executable
    if node_dir is None:
        node = shutil.which("node")
        if not node:
            raise LaunchAgentError("node not found in PATH")
        node_dir = str(Path(node).parent)
    log = home / "Library" / "Logs" / "workspace-cockpit.log"
    plist, app = plist_path(home), app_path(home)
    plist.parent.mkdir(parents=True, exist_ok=True)
    log.parent.mkdir(parents=True, exist_ok=True)
    plist.write_bytes(plistlib.dumps(build_plist(repo, config, python, node_dir, log)))
    if not dry_run:
        app.parent.mkdir(parents=True, exist_ok=True)
        shutil.rmtree(app, ignore_errors=True)
        subprocess.run(["osacompile", "-o", str(app), "-e", app_script(repo, config, python)], check=True, capture_output=True)
        subprocess.run(["launchctl", "bootout", f"{_domain()}/{LABEL}"], capture_output=True)
        subprocess.run(["launchctl", "bootstrap", _domain(), str(plist)], check=True, capture_output=True)
    return {"plist": str(plist), "app": str(app), "log": str(log)}


def uninstall(home: Path | None = None, dry_run: bool = False) -> dict:
    home = home or Path.home()
    if not dry_run:
        subprocess.run(["launchctl", "bootout", f"{_domain()}/{LABEL}"], capture_output=True)
        shutil.rmtree(app_path(home), ignore_errors=True)
    plist_path(home).unlink(missing_ok=True)
    return {"removed": [str(plist_path(home)), str(app_path(home))]}


def is_up(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


def _run(cmd: list[str]) -> int:
    return subprocess.run(cmd, capture_output=True).returncode


def open_ui(port: int, home: Path | None = None, is_up: Callable[[int], bool] = is_up,
            run: Callable[[list[str]], int] = _run, sleep: Callable[[float], None] = time.sleep) -> dict:
    """Opens the page; when the server is down, starts the LaunchAgent and waits for it."""
    home = home or Path.home()
    url = f"http://127.0.0.1:{port}"
    if not is_up(port):
        plist = plist_path(home)
        if not plist.exists():
            raise LaunchAgentError("The server is not running and no LaunchAgent is installed: run `bin/cockpit install`")
        target = f"{_domain()}/{LABEL}"
        if run(["launchctl", "print", target]) != 0:
            run(["launchctl", "bootstrap", _domain(), str(plist)])
        run(["launchctl", "kickstart", target])
        waited = 0
        while not is_up(port):
            if waited >= START_TIMEOUT_S:
                raise LaunchAgentError(f"No answer on {url} after {START_TIMEOUT_S} s: see ~/Library/Logs/workspace-cockpit.log")
            sleep(2)
            waited += 2
    run(["open", url])
    return {"opened": url}
