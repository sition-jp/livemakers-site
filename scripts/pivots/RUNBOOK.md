# AI Turning Point Detector v0.1 Internal Beta — Runbook

> Hidden beta. Not linked from `Header.tsx`. Internal users only.

## Observation freeze policy

During the v0.1-live observation window, do not add product features,
format extensions, scoring-model changes, source expansions, UI polish, or
public navigation links. Only ops fixes that protect trial viability,
stoppability, or detectability are allowed before the public-link decision.

Allowed exception labels:
- Trial viability: the scheduled run does not produce usable observation data.
- Trial stoppability: the trial cannot be stopped or rolled back at the review point.
- Trial detectability: failures are silent or not visible in logs/alerts.

Every exception must record risk, rollback, touched files, and expected next-run
behavior in the PR description or the project operations note.

## Observation status, 2026-05-15 JST

- Window: 8 natural LaunchAgent fires verified from 2026-05-08 through
  2026-05-15 JST morning. The 2026-05-07 install kickstart is separate.
- Ops log: all entries in `scripts/pivots/ops.log.jsonl` are `status=OK`;
  no snapshot-missing run observed.
- Score engine: live scores are moving across runs. The 2026-05-14 UTC
  snapshot first reached `overall=45`, `grade=A` for ETH 30D and ETH 90D.
- Backtest output: structurally valid, but still a v0.1 pipeline smoke artifact;
  do not treat the metrics as a model-performance benchmark.
- Telegram: local evidence verifies `--notify-ok` wiring and OK logs only.
  Actual Telegram receipt must be confirmed by the operator.
- Git: as of 2026-06-14, `main` is synchronized with `origin/main` after the
  PR #7 merge, post-merge snapshot refresh, and local-artifact cleanup commits.
- Current pre-decision blocker update: local `ANTHROPIC_API_KEY` inherited
  launchctl exposure was mitigated on 2026-06-14 by clearing the user launchd
  environment and disabling the old `com.sition.env.loader`; rotate the key if
  exposure is plausible.

## Routes (direct URL only)

- `https://livemakers.com/en/turning-points` — Market Timing Radar
- `https://livemakers.com/en/turning-points/btc` (or `eth`) — Asset Detail
- `https://livemakers.com/en/turning-points/backtest` — Backtest Panel
- Same paths under `/ja/`.

## Daily run

Manual (diagnostic — no auto-commit, no Telegram OK heartbeat):
```
cd /path/to/livemakers-site/scripts/pivots
.venv/bin/python -m ops.run_daily
```

Scheduled (LaunchAgent — recommended; see v0.1-live section below for full setup):
```
bash scripts/pivots/ops/install_launchagent.sh
```

The repository LaunchAgent source of truth runs
`ops.run_daily --auto-commit --auto-publish --notify-ok` daily at 08:00 local
time. After a successful scoped local commit, the publisher uses a separate
standalone clone to create a data-only PR, waits for `guards` and Vercel preview
to pass, squash-merges the exact reviewed head, waits for the merge deployment,
and verifies the public API and page. No manual push is part of the scheduled
path.

Merging the publisher code does not change the currently installed LaunchAgent.
Activation requires a separately approved run of `install_launchagent.sh` after
the credential preflight and production-cutover checklist pass.

For LaunchAgent install/uninstall, Telegram setup, and troubleshooting, see the **v0.1-live** section below.

## Logs

- Per-run JSONL: `scripts/pivots/ops.log.jsonl`
- LaunchAgent stdout/stderr: `~/Library/Logs/sition-livemakers/launchd.stdout.log`
  and `launchd.stderr.log` (moved out of the repo 2026-06-13 — launchd cannot
  pre-open log files inside TCC-protected folders like `~/Documents`; doing so
  fails the spawn with `EX_CONFIG` 78)

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
| `AutoPublishSkipped` | `--auto-publish` was passed without `--auto-commit` | Use both flags for a scheduled publication run |
| `AutoPublishFailed` with `phase=pre_merge` | Source validation, branch/PR identity, checks, or pre-merge work failed | Read the bounded publisher detail; `main` and production were not changed by this run |
| `AutoPublishFailed` with `phase=post_merge` | Merge outcome is uncertain, or deployment/public smoke failed after merge | Treat `main` or production as changed; inspect the PR merge SHA and reconcile production before any revert |
| `AutoPublishFailed` without a phase marker | Publisher was terminated or failed outside its normal exception boundary | Default to production-uncertain; only explicit `phase=pre_merge` permits a preserved-snapshot claim |
| Orphan `.bak` warning at startup | Crash mid-promotion | See Recovery section above |
| Page shows `UnavailableNotice` | JSON missing or parse-rejected | Restore from `data/pivots-history/` and re-run |
| Page shows "very stale" badge | Producer hasn't run for >72h | Re-run `ops.run_daily` manually |

## Out of scope for v0.1 (deferred to v0.2+)

In scope as of v0.1-live (delivered):
- Auto-commit on success (`--auto-commit` flag)
- Guarded data-only production publication (`--auto-publish` flag; activation
  remains a separate production cutover)
- Telegram alerts (OK + FAILED behind `--notify-ok`)
- LaunchAgent install/uninstall scripts
- `fcntl` lock for serialized fires

Still out of scope (v0.2+):
- Public navigation link in `Header.tsx`
- Mobile viewport polish
- Scoring-model upgrades
- ADA / NIGHT support
- External sidecar caching real OI / funding history

Do not add these without explicit re-approval.

## Pre-public-link decision checklist

Before adding a `Header.tsx` link or otherwise making the beta discoverable,
confirm all of the following:

- 14 consecutive calendar days of OK-producing observation are complete.
- Telegram OK receipt is operator-confirmed for the same period.
- Publication policy is locked: only the allowlisted snapshot pair and optional
  derivatives sidecar may enter an automated data-only PR. The publisher must
  never push the daily runner checkout or mix unrelated product work.
- LaunchAgent source of truth is locked. The repo sample plist and the installed
  `~/Library/Application Support/sition-livemakers/run_daily_wrapper.sh` path
  currently represent two install paths; choose one owner before public linking.
- `ANTHROPIC_API_KEY` is rotated if exposed, absent from inherited launchctl
  environment, and only required environment variables are explicitly provided.
- `~/Library/Logs/sition-livemakers/launchd.stderr.log` (the installed launchd
  stderr log) contains only known cosmetic Vite CJS deprecation warnings.

## v0.1-live: LaunchAgent + Telegram + guarded auto-publish

### Operational ownership

**Primary operational AI: Claude.** Claude is the default for routine
monitoring, incident triage, and runbook-led operations. Codex may handle
implementation, review, investigation, or second-opinion work when explicitly
assigned by 田平氏. This preference does not change the deterministic scheduled
automation or its approval boundaries: activation/cutover, rollback, and policy
changes still require explicit human approval.

### GitHub publisher credential (one-time, before cutover)

The publisher reads `~/.sition_secrets/github_autopr.env` only in its child
process. The file must be a regular, non-symlink file owned by the current user
with mode `0600`, and its only assignment must be `GH_TOKEN`. Never place the
value in this runbook, git, logs, launchd environment, or command history.

`install_launchagent.sh` checks only file metadata before changing installed
state. The Python publisher validates the assignment at runtime and redacts the
value from bounded child-process output.

The publisher supplies an empty reset plus `!gh auth git-credential` through
process-scoped Git config before the initial clone, then installs the same
helper pair in the dedicated clone. This makes clone/fetch/push use the same
child-process `GH_TOKEN` as `gh` without persisting its value.

### Telegram setup (one-time, before install)

1. In Telegram, message `@BotFather` and create a dedicated bot:
   - `/newbot`
   - Name: `LiveMakers Ops`
   - Username: `LiveMakersOpsBot` (or another available variant)
2. Add the bot to a chat (DM or group) and call `/start` so the bot can see messages.
3. Get the chat id: visit `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser; copy the `chat.id` from the response.
4. Append two lines to `~/.sition/secrets.env`:
   ```
   TELEGRAM_LIVEMAKERS_BOT_TOKEN="<token>"
   TELEGRAM_LIVEMAKERS_CHAT_ID="<chat id>"
   ```
   The `export KEY="VALUE"` form is also accepted if your secrets.env uses it.
5. Verify `ls -l ~/.sition/secrets.env` shows `-rw-------`. If not: `chmod 600 ~/.sition/secrets.env`.

The installer now requires this file to be regular, non-symlink, current-user
owned, mode `0600`, and accepted by the runtime Telegram loader before it
changes LaunchAgent state.

### Why three flags on the LaunchAgent and not on manual runs

`--auto-commit`, `--auto-publish`, and `--notify-ok` are intentionally OFF by
default for manual runs:

- Manual runs are typically diagnostic — operator does not want commits or OK heartbeat noise on chat
- LaunchAgent runs are headless — all three flags are required for the complete
  zero-touch path
- `--auto-publish` fails closed before producer execution unless
  `--auto-commit` is also present

If an approved diagnostic needs to mirror the complete LaunchAgent behavior,
pass all three flags explicitly:

```bash
python -m ops.run_daily --auto-commit --auto-publish --notify-ok
```

### Install-day extra commit

The first run is a `launchctl kickstart` immediately after install, then the natural fire happens at 08:00 JST the next day. This produces **two snapshot commits in `git log`** on install day, then one per day after. This is normal — not a regression.

### Install / Uninstall

```bash
# Install
bash scripts/pivots/ops/install_launchagent.sh

# Uninstall
bash scripts/pivots/ops/uninstall_launchagent.sh
```

Installation is transactional. The installer backs up the previous plist and
loaded state before replacement. If bootstrap, kickstart, or first-run OK
verification fails, it boots out the new agent and restores the previous plist
and loaded state. A rollback-incomplete error requires immediate operator
inspection before the next 08:00 fire. In that case the installer preserves and
prints the previous plist backup path instead of deleting the last recovery
artifact. The installer captures the PID returned by
`launchctl kickstart -p`; every runner JSONL entry records its PID, and only an
`OK` entry from that exact process satisfies the first-run gate. Unrelated new
log lines cannot produce a false install success.

### Publication state machine and recovery

The automated publisher is fail closed:

1. Validate both public JSON files, matching exact UTC `generated_at`, and the
   optional sidecar.
2. Reset a dedicated publisher clone to `origin/main`, freeze the validated
   source bytes, then commit only the allowlisted snapshot paths on a
   deterministic automation branch. An equal timestamp is accepted only when
   the source blobs equal `origin/main`.
3. Create or safely resume the corresponding PR. Base `main`, exact head name,
   repository owner, PR file set, source blobs, and head SHA are all pinned. A
   remote branch without a PR, merged PR not reflected on fetched `main`,
   unexpected blob, draft/conflict, failed check, or timeout stops publication.
4. Require successful `guards` and `Vercel` checks, squash-merge the pinned head,
   wait for Vercel production success, then smoke the radar API, backtest API,
   and `/ja/turning-points` against the expected timestamp.
5. Delete the automation branch after success. Cleanup failure is reported but
   does not turn an already verified production publication into failure.

On `phase=pre_merge`, inspect the final JSONL entry and GitHub PR state. Do not
manually merge a failed-check PR. Correct the named cause and let the next daily
run resume or supersede it.

On `phase=post_merge`, do not claim the previous snapshot was preserved. Inspect
the PR and merge SHA, verify `origin/main`, Vercel production, and the three
public smoke targets. The next run can reconcile an already-current valid merge;
a bad merged snapshot requires a separately reviewed revert. The publisher does
not auto-revert.

### Roll back automated publication

Rollback is an explicit production operation: remove `--auto-publish` from the
installed plist source, reinstall the LaunchAgent, and verify the kickstart log.
This leaves daily generation, scoped local commits, and Telegram heartbeat in
place while disabling PR creation and merge. Do not delete credentials or
publisher branches as part of the same rollback until their state is inspected.
This manual rollback applies after a successful cutover. A failed installer
kickstart automatically restores the prior agent as described above.

### Troubleshooting missed natural fire

If no OK Telegram arrives by 08:30 JST:

```bash
# Check the agent's current state and next-fire time
launchctl print "gui/$(id -u)/com.sition.livemakers.pivots.daily" | grep -E "(state|next-time)"

# Check launchd's stderr for the agent
tail -50 ~/Library/Logs/sition-livemakers/launchd.stderr.log

# Compare last log entry timestamp to today's expected fire
tail -1 scripts/pivots/ops.log.jsonl

# Check whether the lock is stuck (rare — should never persist after process exit)
ls -l scripts/pivots/.run_daily.lock 2>/dev/null
```

Common causes:

- `last exit code = 78: EX_CONFIG` with no new log lines anywhere → launchd
  could not spawn the service at all. Most likely a plist path (typically
  `StandardOutPath`/`StandardErrorPath`) points inside a TCC-protected folder
  (`~/Documents` etc.); launchd's pre-exec open is denied there. Reinstall via
  `install_launchagent.sh` (logs go to `~/Library/Logs/sition-livemakers/`)
- Laptop closed at 08:00 → launchd will fire on next wake, but the run may then be > 24 h late
- secrets.env got moved, symlinked, or chmod'd → Telegram silent-skips even though run succeeded; check `git log` for the auto-commit
- `github_autopr.env` missing, symlinked, wrong owner, or not `0600` → installer
  stops before changing LaunchAgent state; fix metadata without printing the
  credential
- Plist `WorkingDirectory` points at a different repo path → reinstall to refresh
- `LockBusy` Telegram FAILED received → another `run_daily` process is hung; `ps aux | grep run_daily` and kill stale ones if needed
- Manual run earlier today held the lock during the scheduled fire window → check `ops.log.jsonl` for a recent `LockBusy` entry

### launchctl terminology

This RUNBOOK and the install/uninstall scripts use the modern `bootstrap`/`bootout`/`kickstart` syntax. The legacy `load`/`unload` syntax is **deprecated** (it still works but mixes confusingly with `bootstrap`-installed agents). Do not mix the two.

## Derivatives History Sidecar

The daily producer also maintains:

```text
data/pivot_derivatives_history.live.json
```

This is an internal historical OI/funding cache for future backtest calibration.
It is not a public API contract and does not change current scores, confidence,
or AI Auto Trader gating.

The public snapshots remain:

```text
data/pivot_assets.live.json
data/pivot_backtest.live.json
```

`pivot_assets.live.json` and `pivot_backtest.live.json` are promoted as an
atomic pair. The derivatives sidecar is promoted after that pair as a separate
best-effort transaction.

If logs contain:

```text
sidecar degraded: <reason>
```

the public snapshots succeeded but the sidecar was preserved from the previous
run or skipped for that run. Treat this as an ops note, not a public snapshot
failure. If a sidecar `.bak` remains, inspect the current sidecar and `.bak`,
choose the canonical copy, and remove the stale file before the next run.
