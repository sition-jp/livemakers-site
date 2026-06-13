#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PLIST_NAME="com.sition.livemakers.pivots.daily.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
PLIST_SRC="$REPO_ROOT/scripts/pivots/ops/samples/$PLIST_NAME"
LABEL="com.sition.livemakers.pivots.daily"
DOMAIN="gui/$(id -u)"
LOG_FILE="$REPO_ROOT/scripts/pivots/ops.log.jsonl"

# 1. Create venv if missing
if [ ! -x "$REPO_ROOT/scripts/pivots/.venv/bin/python" ]; then
  python3 -m venv "$REPO_ROOT/scripts/pivots/.venv"
fi

# 2. Substitute REPLACE_REPO_PATH / REPLACE_HOME and place plist.
# launchd log paths must live outside TCC-protected folders (~/Documents
# etc.) or the service fails to spawn with EX_CONFIG (78) — see sample
# plist comment.
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/Library/Logs/sition-livemakers"
sed -e "s|REPLACE_REPO_PATH|$REPO_ROOT|g" -e "s|REPLACE_HOME|$HOME|g" "$PLIST_SRC" > "$PLIST_DST"

# 3. Warn if secrets.env missing or wrong perm
if [ ! -f "$HOME/.sition/secrets.env" ]; then
  echo "WARN: ~/.sition/secrets.env not found — Telegram will silently skip until added"
elif [ "$(stat -f '%Lp' "$HOME/.sition/secrets.env")" != "600" ]; then
  echo "WARN: ~/.sition/secrets.env perms not 0600 — Telegram will silently skip"
  echo "  fix: chmod 600 ~/.sition/secrets.env"
fi

# 4. Conditional bootout — only if currently loaded
if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  echo "service currently loaded; booting out before reinstall"
  if ! launchctl bootout "$DOMAIN/$LABEL"; then
    echo "ERROR: launchctl bootout failed — investigate before reinstall" >&2
    launchctl print "$DOMAIN/$LABEL" >&2 || true
    exit 1
  fi
fi

# 5. Capture pre-kickstart line count
PRE_LINES=0
if [ -f "$LOG_FILE" ]; then
  PRE_LINES="$(wc -l < "$LOG_FILE" | tr -d ' ')"
fi
echo "pre-kickstart log line count: $PRE_LINES"

# 6. Bootstrap (load)
launchctl bootstrap "$DOMAIN" "$PLIST_DST"

# 7. Kickstart (immediate single fire)
launchctl kickstart -k "$DOMAIN/$LABEL"

# 8. Poll until log line count increases AND new entry has status=OK
echo "polling $LOG_FILE for first-run entry..."
DEADLINE=$(($(date +%s) + 120))
while [ $(date +%s) -lt $DEADLINE ]; do
  if [ -f "$LOG_FILE" ]; then
    NOW_LINES="$(wc -l < "$LOG_FILE" | tr -d ' ')"
    if [ "$NOW_LINES" -gt "$PRE_LINES" ]; then
      LATEST_LINE="$(tail -1 "$LOG_FILE")"
      STATUS="$(printf '%s' "$LATEST_LINE" | sed -nE 's/.*"status":[[:space:]]*"([^"]+)".*/\1/p')"
      echo "--- ops.log.jsonl (first-run entry) ---"
      printf '%s\n' "$LATEST_LINE"
      if [ "$STATUS" = "OK" ]; then
        echo "first-run OK"
        exit 0
      fi
      echo "ERROR: first-run status=\"$STATUS\" (expected OK)" >&2
      echo "  inspect launchd.stderr.log for details" >&2
      exit 2
    fi
  fi
  sleep 3
done

echo "WARN: log line count did not increase within 120 s (was $PRE_LINES)" >&2
echo "  inspect launchd.stderr.log and ops.log.jsonl manually" >&2
exit 2
