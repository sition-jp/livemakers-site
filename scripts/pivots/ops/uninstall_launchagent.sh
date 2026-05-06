#!/usr/bin/env bash
set -euo pipefail
LABEL="com.sition.livemakers.pivots.daily"
DOMAIN="gui/$(id -u)"
PLIST_DST="$HOME/Library/LaunchAgents/$LABEL.plist"

if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
  if ! launchctl bootout "$DOMAIN/$LABEL"; then
    echo "ERROR: launchctl bootout failed" >&2
    exit 1
  fi
fi
rm -f "$PLIST_DST"
echo "uninstalled"
