from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


INSTALLER = Path(__file__).resolve().parents[1] / "ops" / "install_launchagent.sh"
PLIST_NAME = "com.sition.livemakers.pivots.daily.plist"


def _write_executable(path: Path, body: str) -> None:
    path.write_text(body, encoding="utf-8")
    path.chmod(0o755)


def _installer_fixture(
    tmp_path: Path,
    *,
    telegram_present: bool = True,
    kickstart_status: str = "FAILED",
) -> tuple[Path, dict[str, str], Path, Path]:
    repo = tmp_path / "repo"
    ops = repo / "scripts" / "pivots" / "ops"
    samples = ops / "samples"
    samples.mkdir(parents=True)
    installer = ops / "install_launchagent.sh"
    shutil.copy2(INSTALLER, installer)
    (samples / PLIST_NAME).write_text(
        "REPLACE_REPO_PATH\nREPLACE_HOME\n--auto-publish\n",
        encoding="utf-8",
    )

    python = repo / "scripts" / "pivots" / ".venv" / "bin" / "python"
    python.parent.mkdir(parents=True)
    _write_executable(python, "#!/bin/sh\nexit 0\n")

    home = tmp_path / "home"
    launch_agents = home / "Library" / "LaunchAgents"
    launch_agents.mkdir(parents=True)
    plist = launch_agents / PLIST_NAME
    plist.write_text("previous-plist\n", encoding="utf-8")

    github_token = home / ".sition_secrets" / "github_autopr.env"
    github_token.parent.mkdir(parents=True)
    github_token.write_text("GH_TOKEN=unit-secret\n", encoding="utf-8")
    github_token.chmod(0o600)

    if telegram_present:
        telegram = home / ".sition" / "secrets.env"
        telegram.parent.mkdir(parents=True)
        telegram.write_text(
            "TELEGRAM_LIVEMAKERS_BOT_TOKEN=unit-token\n"
            "TELEGRAM_LIVEMAKERS_CHAT_ID=unit-chat\n",
            encoding="utf-8",
        )
        telegram.chmod(0o600)

    state = tmp_path / "launchctl.state"
    state.write_text("loaded\n", encoding="utf-8")
    actions = tmp_path / "launchctl.actions"
    log_file = repo / "scripts" / "pivots" / "ops.log.jsonl"
    log_file.write_text('{"status":"OK"}\n', encoding="utf-8")

    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    _write_executable(
        fake_bin / "launchctl",
        """#!/bin/sh
echo "$*" >> "$PIVOTS_TEST_ACTIONS"
case "$1" in
  print)
    grep -q '^loaded$' "$PIVOTS_TEST_STATE"
    ;;
  bootout)
    echo unloaded > "$PIVOTS_TEST_STATE"
    ;;
  bootstrap)
    echo loaded > "$PIVOTS_TEST_STATE"
    ;;
  kickstart)
    printf '{"status":"%s"}\n' "$PIVOTS_TEST_STATUS" >> "$PIVOTS_TEST_LOG"
    ;;
esac
""",
    )

    env = dict(os.environ)
    env.update(
        {
            "HOME": str(home),
            "PATH": f"{fake_bin}:/usr/bin:/bin:/usr/sbin:/sbin",
            "PIVOTS_TEST_ACTIONS": str(actions),
            "PIVOTS_TEST_STATE": str(state),
            "PIVOTS_TEST_LOG": str(log_file),
            "PIVOTS_TEST_STATUS": kickstart_status,
        }
    )
    return installer, env, plist, actions


def test_failed_kickstart_restores_previous_plist_and_loaded_agent(
    tmp_path: Path,
) -> None:
    installer, env, plist, actions = _installer_fixture(tmp_path)

    result = subprocess.run(
        ["bash", str(installer)],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    )

    assert result.returncode == 2
    assert plist.read_text(encoding="utf-8") == "previous-plist\n"
    recorded = actions.read_text(encoding="utf-8").splitlines()
    assert sum(line.startswith("bootout ") for line in recorded) == 2
    assert sum(line.startswith("bootstrap ") for line in recorded) == 2
    assert "restored previous LaunchAgent" in result.stderr


def test_successful_kickstart_keeps_new_plist_and_loaded_agent(tmp_path: Path) -> None:
    installer, env, plist, actions = _installer_fixture(
        tmp_path,
        kickstart_status="OK",
    )

    result = subprocess.run(
        ["bash", str(installer)],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    )

    assert result.returncode == 0
    assert "--auto-publish" in plist.read_text(encoding="utf-8")
    recorded = actions.read_text(encoding="utf-8").splitlines()
    assert sum(line.startswith("bootout ") for line in recorded) == 1
    assert sum(line.startswith("bootstrap ") for line in recorded) == 1
    assert "first-run OK" in result.stdout


def test_missing_telegram_credentials_fails_before_installed_state_change(
    tmp_path: Path,
) -> None:
    installer, env, plist, actions = _installer_fixture(
        tmp_path,
        telegram_present=False,
    )

    result = subprocess.run(
        ["bash", str(installer)],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    )

    assert result.returncode == 1
    assert "Telegram credential" in result.stderr
    assert plist.read_text(encoding="utf-8") == "previous-plist\n"
    assert not actions.exists()
