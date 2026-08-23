#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PLIST_NAME="com.sition.livemakers.pivots.daily.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
PLIST_SRC="$REPO_ROOT/scripts/pivots/ops/samples/$PLIST_NAME"
LABEL="com.sition.livemakers.pivots.daily"
DOMAIN="gui/$(id -u)"
LOG_FILE="$REPO_ROOT/scripts/pivots/ops.log.jsonl"
GITHUB_TOKEN_FILE="$HOME/.sition_secrets/github_autopr.env"
TELEGRAM_SECRETS_FILE="$HOME/.sition/secrets.env"
PYTHON_BIN="$REPO_ROOT/scripts/pivots/.venv/bin/python"
PREVIOUS_PLIST_BACKUP=""
PREVIOUS_LOADED=0
INSTALL_MUTATED=0
VERIFY_TIMEOUT_SECONDS="${PIVOTS_INSTALL_VERIFY_TIMEOUT_SECONDS:-120}"

case "$VERIFY_TIMEOUT_SECONDS" in
  ''|*[!0-9]*)
    echo "ERROR: PIVOTS_INSTALL_VERIFY_TIMEOUT_SECONDS must be a positive integer" >&2
    exit 1
    ;;
esac
if [ "$VERIFY_TIMEOUT_SECONDS" -le 0 ]; then
  echo "ERROR: PIVOTS_INSTALL_VERIFY_TIMEOUT_SECONDS must be a positive integer" >&2
  exit 1
fi

finish_install() {
  status=$?
  trap - EXIT
  set +e
  preserve_backup=0
  if [ "$status" -ne 0 ] && [ "$INSTALL_MUTATED" -eq 1 ]; then
    rollback_ok=1
    if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
      if ! launchctl bootout "$DOMAIN/$LABEL" >/dev/null 2>&1; then
        rollback_ok=0
      fi
    fi
    if [ -n "$PREVIOUS_PLIST_BACKUP" ] && [ -f "$PREVIOUS_PLIST_BACKUP" ]; then
      if ! cp -p "$PREVIOUS_PLIST_BACKUP" "$PLIST_DST"; then
        rollback_ok=0
      fi
      if [ "$PREVIOUS_LOADED" -eq 1 ] && [ "$rollback_ok" -eq 1 ]; then
        if ! launchctl bootstrap "$DOMAIN" "$PLIST_DST" >/dev/null 2>&1; then
          rollback_ok=0
        fi
      fi
    else
      if ! rm -f "$PLIST_DST"; then
        rollback_ok=0
      fi
    fi
    if [ "$rollback_ok" -eq 1 ] && [ -n "$PREVIOUS_PLIST_BACKUP" ]; then
      echo "ERROR: install failed; restored previous LaunchAgent" >&2
    elif [ "$rollback_ok" -eq 1 ]; then
      echo "ERROR: install failed; removed new LaunchAgent" >&2
    else
      echo "ERROR: install failed and rollback is incomplete; inspect launchctl immediately" >&2
      if [ -n "$PREVIOUS_PLIST_BACKUP" ] && [ -f "$PREVIOUS_PLIST_BACKUP" ]; then
        preserve_backup=1
        echo "ERROR: previous plist backup preserved at: $PREVIOUS_PLIST_BACKUP" >&2
      fi
    fi
  fi
  if [ -n "$PREVIOUS_PLIST_BACKUP" ] && [ "$preserve_backup" -eq 0 ]; then
    rm -f "$PREVIOUS_PLIST_BACKUP"
  fi
  exit "$status"
}
trap finish_install EXIT

# 1. Fail before changing installed state unless the publisher credential has
# safe metadata. Never read or print the credential value here.
if [ -L "$GITHUB_TOKEN_FILE" ] || [ ! -f "$GITHUB_TOKEN_FILE" ]; then
  echo "ERROR: GitHub publisher credential must be a regular, non-symlink file: $GITHUB_TOKEN_FILE" >&2
  exit 1
fi
if [ "$(stat -f '%u' "$GITHUB_TOKEN_FILE")" != "$(id -u)" ]; then
  echo "ERROR: GitHub publisher credential must be owned by the current user" >&2
  exit 1
fi
if [ "$(stat -f '%Lp' "$GITHUB_TOKEN_FILE")" != "600" ]; then
  echo "ERROR: GitHub publisher credential permissions must be 0600" >&2
  echo "  fix: chmod 600 $GITHUB_TOKEN_FILE" >&2
  exit 1
fi

# 2. Telegram is part of the headless completion signal. Require the same
# metadata that the runtime loader enforces before touching installed state.
if [ -L "$TELEGRAM_SECRETS_FILE" ] || [ ! -f "$TELEGRAM_SECRETS_FILE" ]; then
  echo "ERROR: Telegram credential must be a regular, non-symlink file" >&2
  exit 1
fi
if [ "$(stat -f '%u' "$TELEGRAM_SECRETS_FILE")" != "$(id -u)" ]; then
  echo "ERROR: Telegram credential must be owned by the current user" >&2
  exit 1
fi
if [ "$(stat -f '%Lp' "$TELEGRAM_SECRETS_FILE")" != "600" ]; then
  echo "ERROR: Telegram credential permissions must be 0600" >&2
  exit 1
fi

# 3. Create venv if missing, then require the runtime Telegram loader to accept
# both required keys. The credential values are never printed.
if [ ! -x "$PYTHON_BIN" ]; then
  python3 -m venv "$REPO_ROOT/scripts/pivots/.venv"
fi
if ! (
  cd "$REPO_ROOT/scripts/pivots"
  "$PYTHON_BIN" -c 'from ops.alert import _load_telegram_credentials; raise SystemExit(0 if _load_telegram_credentials() else 1)'
); then
  echo "ERROR: Telegram credential is missing required LiveMakers keys" >&2
  exit 1
fi

# 4. Capture the previous installed state before replacing the plist. A failed
# bootstrap, kickstart, or first-run verification restores this exact state.
if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  PREVIOUS_LOADED=1
fi
if [ -e "$PLIST_DST" ]; then
  if [ -L "$PLIST_DST" ] || [ ! -f "$PLIST_DST" ]; then
    echo "ERROR: existing LaunchAgent plist is not a regular file" >&2
    exit 1
  fi
  PREVIOUS_PLIST_BACKUP="$(mktemp "${TMPDIR:-/tmp}/pivots-launchagent.XXXXXX")"
  cp -p "$PLIST_DST" "$PREVIOUS_PLIST_BACKUP"
elif [ "$PREVIOUS_LOADED" -eq 1 ]; then
  echo "ERROR: loaded LaunchAgent has no restorable plist" >&2
  exit 1
fi

# 5. Substitute REPLACE_REPO_PATH / REPLACE_HOME and place plist.
# launchd log paths must live outside TCC-protected folders (~/Documents
# etc.) or the service fails to spawn with EX_CONFIG (78) — see sample
# plist comment.
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/Library/Logs/sition-livemakers"
INSTALL_MUTATED=1
sed -e "s|REPLACE_REPO_PATH|$REPO_ROOT|g" -e "s|REPLACE_HOME|$HOME|g" "$PLIST_SRC" > "$PLIST_DST"

# 6. Conditional bootout — only if previously loaded
if [ "$PREVIOUS_LOADED" -eq 1 ]; then
  echo "service currently loaded; booting out before reinstall"
  if ! launchctl bootout "$DOMAIN/$LABEL"; then
    echo "ERROR: launchctl bootout failed — investigate before reinstall" >&2
    launchctl print "$DOMAIN/$LABEL" >&2 || true
    exit 1
  fi
fi

# 7. Capture pre-kickstart line count
PRE_LINES=0
if [ -f "$LOG_FILE" ]; then
  PRE_LINES="$(wc -l < "$LOG_FILE" | tr -d ' ')"
fi
echo "pre-kickstart log line count: $PRE_LINES"

# 8. Bootstrap (load)
launchctl bootstrap "$DOMAIN" "$PLIST_DST"

# 9. Kickstart (immediate single fire) and capture the exact process identity.
KICKSTART_OUTPUT="$(launchctl kickstart -kp "$DOMAIN/$LABEL")"
KICKSTART_PID="$(printf '%s' "$KICKSTART_OUTPUT" | tr -d '[:space:]')"
case "$KICKSTART_PID" in
  ''|*[!0-9]*)
    echo "ERROR: launchctl kickstart did not return a valid PID" >&2
    exit 1
    ;;
esac
echo "kickstarted PID: $KICKSTART_PID"

# 10. Poll until the entry emitted by that exact PID has status=OK. Other new
# log lines are ignored rather than being mistaken for this install run.
echo "polling $LOG_FILE for first-run entry..."
DEADLINE=$(($(date +%s) + VERIFY_TIMEOUT_SECONDS))
while [ $(date +%s) -lt $DEADLINE ]; do
  if [ -f "$LOG_FILE" ]; then
    NOW_LINES="$(wc -l < "$LOG_FILE" | tr -d ' ')"
    if [ "$NOW_LINES" -gt "$PRE_LINES" ]; then
      MATCHING_LINE="$("$PYTHON_BIN" -c '
import json
import sys

path, start, expected_pid = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines()[start:]
for line in lines:
    try:
        payload = json.loads(line)
    except (TypeError, ValueError):
        continue
    if payload.get("pid") == expected_pid:
        print(line)
        break
' "$LOG_FILE" "$PRE_LINES" "$KICKSTART_PID")"
      if [ -n "$MATCHING_LINE" ]; then
        STATUS="$(printf '%s' "$MATCHING_LINE" | sed -nE 's/.*"status":[[:space:]]*"([^"]+)".*/\1/p')"
        echo "--- ops.log.jsonl (kickstarted first-run entry) ---"
        printf '%s\n' "$MATCHING_LINE"
        if [ "$STATUS" = "OK" ]; then
          echo "first-run OK"
          exit 0
        fi
        echo "ERROR: kickstarted first-run status=\"$STATUS\" (expected OK)" >&2
        echo "  inspect launchd.stderr.log for details" >&2
        exit 2
      fi
    fi
  fi
  sleep 3
done

echo "WARN: did not observe an ops log entry for kickstarted PID $KICKSTART_PID within $VERIFY_TIMEOUT_SECONDS s" >&2
echo "  inspect launchd.stderr.log and ops.log.jsonl manually" >&2
exit 2
