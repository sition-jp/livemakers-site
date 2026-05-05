# AI Turning Point Detector v0.1 Internal Beta — Runbook

> Hidden beta. Not linked from `Header.tsx`. Internal users only.

## Routes (direct URL only)

- `https://livemakers.com/en/turning-points` — Market Timing Radar
- `https://livemakers.com/en/turning-points/btc` (or `eth`) — Asset Detail
- `https://livemakers.com/en/turning-points/backtest` — Backtest Panel
- Same paths under `/ja/`.

## Daily run

Manual:
```
cd /path/to/livemakers-site/scripts/pivots
.venv/bin/python -m ops.run_daily
```

Scheduled (LaunchAgent — recommended):
```
cp ops/samples/com.sition.livemakers.pivots.daily.plist ~/Library/LaunchAgents/
# edit the plist to replace REPLACE_REPO_PATH
launchctl load ~/Library/LaunchAgents/com.sition.livemakers.pivots.daily.plist
```

After a successful run:
```
git add data/pivot_assets.live.json data/pivot_backtest.live.json
git commit -m "ops(pivots): daily snapshot YYYYMMDD"
git push origin main
```

(Auto-commit is deferred to v0.1-live.)

## Logs

- Per-run JSONL: `scripts/pivots/ops.log.jsonl`
- LaunchAgent stdout/stderr: `scripts/pivots/launchd.stdout.log` and `.stderr.log`

## Snapshot history

- Last 7 successful snapshots per file under `data/pivots-history/`
  (gitignored)
- Restore an older snapshot:
  ```
  cp data/pivots-history/pivot_assets.live.YYYYMMDDTHHMMSSZ.json data/pivot_assets.live.json
  ```

## Recovery from orphan `*.bak`

If a previous run crashed mid-promotion you'll see
`data/pivot_*.live.json.bak` files. The producer refuses to run until
they're resolved. Compare against the current target and either:

```
mv data/pivot_assets.live.json.bak data/pivot_assets.live.json   # promote .bak forward
# OR
rm data/pivot_assets.live.json.bak                                # discard .bak
```

Then re-run `ops.run_daily`.

## Failure response (cheat sheet)

| Symptom | Likely cause | Fix |
|---|---|---|
| `DryRunFailed` in log | Binance fetch failure or zod validation regression | Re-run after a few minutes; check `producer.run_producer` output |
| `LiveWriteFailed` after `DryRunFailed` was OK | Promote-step OS error or zod failure on tmps | Inspect `data/pivots-history/` and roll back if needed |
| `RetentionFailed` | `data/pivots-history/` missing or unwritable | Recreate dir; live write was already successful |
| Orphan `.bak` warning at startup | Crash mid-promotion | See Recovery section above |
| Page shows `UnavailableNotice` | JSON missing or parse-rejected | Restore from `data/pivots-history/` and re-run |
| Page shows "very stale" badge | Producer hasn't run for >72h | Re-run `ops.run_daily` manually |

## Out of scope for v0.1-ops

- Public navigation link in `Header.tsx`
- Auto-commit on success
- Telegram alerts
- Scoring-model upgrades
- ADA / NIGHT support

These belong to v0.1-live or v0.2+. Do not add them here without explicit re-approval.
