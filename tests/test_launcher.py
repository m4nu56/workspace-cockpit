import os
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def launch(cwd: Path, *args: str, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run([str(REPO / "bin" / "cockpit"), "start", *args], cwd=cwd, capture_output=True, text=True,
                          env={**os.environ, "COCKPIT_DRY_RUN": "1", **(env or {})})


def test_relative_config_env_is_made_absolute(tmp_path):
    (tmp_path / "conf").mkdir()
    (tmp_path / "conf" / "cockpit.toml").write_text('root = ".."\n')
    r = launch(tmp_path, env={"COCKPIT_CONFIG": "conf/cockpit.toml"})
    assert r.returncode == 0, r.stderr
    assert r.stdout.strip().splitlines()[-1] == f"config={(tmp_path / 'conf' / 'cockpit.toml').resolve()}"


def test_config_equals_form(tmp_path):
    (tmp_path / "c.toml").write_text('root = "."\n')
    r = launch(tmp_path, "--config=c.toml")
    assert r.returncode == 0, r.stderr
    assert r.stdout.strip().splitlines()[-1] == f"config={(tmp_path / 'c.toml').resolve()}"


def test_no_config_is_refused(tmp_path):
    env = {k: v for k, v in os.environ.items() if k != "COCKPIT_CONFIG"}
    r = subprocess.run([str(REPO / "bin" / "cockpit"), "start"], cwd=tmp_path, capture_output=True, text=True,
                       env={**env, "COCKPIT_DRY_RUN": "1"})
    assert r.returncode == 1 and "No cockpit.toml" in r.stderr
