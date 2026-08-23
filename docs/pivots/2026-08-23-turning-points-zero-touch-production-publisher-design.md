# AI Turning Point Zero-Touch Production Publisher Design

> Date: 2026-08-23
> Status: Approved by 田平氏
> Scope: AI Turning Point daily snapshot delivery from the dedicated runner to LiveMakers production

## 1. Problem

The 08:00 JST LaunchAgent successfully generates and commits daily Turning Point
snapshots in the dedicated runner worktree, but that worktree is a local-only
parking branch. Vercel builds production from `sition-jp/livemakers-site:main`, so
the generated data does not reach production without a manual data-only PR.

The current boundary is therefore:

```text
daily producer -> runner-local commit -> stop
```

The required boundary is:

```text
daily producer
  -> runner-local scoped commit
  -> data-only PR
  -> guards + Vercel preview green
  -> squash merge
  -> Vercel production success
  -> public API/page smoke
```

The complete path after the daily producer is authorized to run without human
interaction. Code/config changes remain human-reviewed through the normal PR
workflow.

## 2. Current Constraints

- `main` has branch protection with required check `guards` and
  `enforce_admins=true`.
- Repository auto-merge is disabled.
- A direct push to `main` is therefore not the publication mechanism.
- The runner branch must never be merged or rebased wholesale into `main`.
- Only these snapshot paths may enter an automated publication commit:
  - `data/pivot_assets.live.json`
  - `data/pivot_backtest.live.json`
  - `data/pivot_derivatives_history.live.json` when present
- Assets and backtest are the public atomic pair. The derivatives sidecar remains
  best-effort and internal.
- AI Turning Point remains a G1 read-only Market State Radar. This change does not
  add trading instructions, AT/SDE signalization, scoring changes, schema changes,
  or new public surfaces.

## 3. Chosen Architecture

### 3.1 Runner integration

`ops.run_daily` gains an opt-in `--auto-publish` flag. It is valid only together
with `--auto-commit`. The publisher runs after producer, promotion,
archive/prune, and scoped local commit have all succeeded.

The existing run lock remains held through publication. This prevents a second
manual or scheduled run from replacing source artifacts while the PR is being
validated and merged.

### 3.2 Dedicated publisher clone

Publishing uses a standalone clone at:

```text
~/.sition_runners/livemakers-pivots-publisher
```

It is not a linked worktree and does not touch the development checkout or the
parking branch. Every run fetches `origin/main`, starts from that exact ref, and
uses a deterministic branch:

```text
automation/pivots-daily-YYYYMMDDTHHMMSSZ
```

The source snapshot is copied into this clone only after local validation. Git
status and the resulting commit are both checked against the three-path
allowlist. Any unrelated modification fails closed.

### 3.3 Snapshot validation

Before push:

1. Parse assets and backtest as JSON.
2. Require equal, valid UTC `generated_at` values for the public pair.
3. Reject a source public snapshot older than `origin/main`.
4. Run the existing Zod snapshot validator against the source files.
5. If the sidecar exists, require `load_derivatives_history_sidecar()` to accept
   it.
6. Require the staged/committed path set to be an allowlisted subset containing
   both public files.

An unchanged or newer `origin/main` is an idempotent no-op followed by production
smoke against the timestamp already on `main`.

### 3.4 GitHub publication state machine

The publisher creates a non-draft data-only PR. It then polls GitHub with a
bounded timeout and requires:

- `guards`: success
- `Vercel`: success
- PR state: open, non-draft, mergeable

`Vercel Preview Comments` is informational and is not a merge gate. A failed,
cancelled, or timed-out required result stops publication and leaves the PR open
for diagnosis.

After green, the publisher calls the GitHub merge API with `merge_method=squash`.
This avoids checkout/pull side effects from `gh pr merge`. The response must say
`merged=true` and return the merge SHA.

If the deterministic branch or PR already exists, the publisher resumes its
state instead of creating a duplicate. A closed, unmerged PR is an explicit
failure requiring operator inspection.

### 3.5 Production verification

After merge, publication is not complete until all of the following pass:

1. The merge SHA receives Vercel production status `success`.
2. `https://livemakers.com/api/pivot-radar` returns HTTP 200 and the expected
   snapshot timestamp.
3. A known backtest query returns HTTP 200 with metrics.
4. `https://livemakers.com/ja/turning-points` returns HTTP 200.

Checks are bounded and retry only while deployment is pending. The publisher
does not automatically roll back a failed deployment; Vercel continues serving
the previous successful production deployment and the runner emits a FAILED
alert.

## 4. Credentials and Secret Boundary

GitHub credentials are read from:

```text
~/.sition_secrets/github_autopr.env
```

The reader accepts only `GH_TOKEN=...` or `export GH_TOKEN=...`, requires a
regular non-symlink file owned by the current user with mode `0600`, and passes
the value only to child `git`/`gh` processes. The token value must never enter
stdout, stderr, JSONL logs, Telegram, git, PR text, or memory.

The token is not added to the LaunchAgent plist or inherited launchd
environment.

## 5. Failure Semantics

| Failure | Production | Runner artifact | Alert |
|---|---|---|---|
| producer / Zod failure | unchanged | previous preserved | FAILED |
| local auto-commit failure | unchanged | generated files may exist locally | FAILED |
| credential / clone / push failure | unchanged | committed locally | FAILED |
| PR checks fail or timeout | unchanged | committed locally; PR retained | FAILED |
| merge API rejects | unchanged | committed locally; PR retained | FAILED |
| production deploy/smoke fails | previous successful deployment normally remains served | merge already recorded | FAILED |
| production already at same/newer timestamp | unchanged/current | no duplicate PR | OK, already current |

The final Telegram OK means production smoke completed, not merely that local
generation completed.

## 6. Observability

- `ops.log.jsonl` remains the durable run record.
- Success details include source timestamp, PR URL when created, merge SHA, and
  production smoke result.
- Failure details are bounded and secret-free.
- The existing Telegram dispatcher remains best-effort; JSONL remains
  authoritative.

## 7. Rollout and Rollback

Implementation is delivered in two independent PRs:

1. Python sidecar test-path isolation.
2. Zero-touch publisher and runner wiring.

Merging code does not activate publication. Activation is a separate production
cutover:

1. Apply the reviewed implementation commit to the dedicated runner branch.
2. Bootstrap/verify the dedicated publisher clone and credential file metadata.
3. Reinstall the LaunchAgent with `--auto-publish`.
4. Run one controlled kickstart and verify the complete production path.
5. Observe the next natural 08:00 JST fire.

Rollback is to reinstall the LaunchAgent without `--auto-publish`. Producer,
archive, local auto-commit, and Telegram behavior then return to the current
state without deleting generated data or branches.

## 8. Non-Goals

- No direct push to `main`.
- No bypass of `guards` or Vercel preview.
- No repository setting or branch-protection change.
- No automatic rollback of a merged production commit.
- No scoring, schema, API, UI, nav, AT, or SDE integration changes.
- No publication of the derivatives sidecar as a public API contract.
