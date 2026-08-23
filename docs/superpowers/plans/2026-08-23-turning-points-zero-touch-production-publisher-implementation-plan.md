# AI Turning Point Zero-Touch Production Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish each successful daily Turning Point snapshot through a guarded data-only PR, automated squash merge, Vercel production deployment, and public smoke test.

**Architecture:** `ops.run_daily --auto-publish` invokes a separate Python publisher after scoped local commit. The publisher copies only allowlisted data into a dedicated standalone clone based on `origin/main`, validates it, drives GitHub through `gh`, and fails closed on every incomplete state.

**Tech Stack:** Python 3.11+, standard library, git CLI, GitHub CLI, Vitest/Zod, pytest, Vercel GitHub status, macOS LaunchAgent.

**Spec:** `docs/pivots/2026-08-23-turning-points-zero-touch-production-publisher-design.md`

## Global Constraints

- Automated commits may contain only the two public snapshots and optional derivatives sidecar.
- Assets and backtest must share one valid UTC `generated_at`.
- `guards` and Vercel preview must be green before merge.
- Production completion requires merge-SHA Vercel success plus public smoke.
- GitHub secrets remain child-process-only and never enter logs or output.
- Merging this PR must not activate the installed LaunchAgent; cutover is separate.
- No score, schema, API response shape, UI, nav, AT, or SDE behavior changes.

---

### Task 1: Source validation and credential boundary

**Files:**
- Create: `scripts/pivots/ops/publish_snapshot.py`
- Create: `scripts/pivots/tests/test_publish_snapshot.py`

**Interfaces:**
- Produces: `PublishError`, `PublishOutcome`, `PublishConfig`, `publish_snapshot()`.
- Produces: `_load_github_env()` that returns an environment mapping without logging the token.
- Produces: `_load_source_snapshot()` that returns the public-pair UTC timestamp.

- [ ] **Step 1: Write failing tests for source consistency and secret-file safety**

```python
def test_source_pair_requires_matching_generated_at(tmp_path): ...
def test_github_env_rejects_symlink_or_non_0600_file(tmp_path): ...
def test_github_env_never_includes_token_in_error(tmp_path): ...
def test_valid_sidecar_is_accepted_and_invalid_sidecar_fails(tmp_path): ...
```

- [ ] **Step 2: Verify the tests fail**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_publish_snapshot.py`

Expected: import failure because `ops.publish_snapshot` does not exist.

- [ ] **Step 3: Implement strict local validation**

Implement:

```python
@dataclass(frozen=True)
class PublishConfig:
    publisher_repo: Path
    token_file: Path
    repository: str = "sition-jp/livemakers-site"
    production_base_url: str = "https://livemakers.com"
    check_timeout_seconds: int = 1200
    deploy_timeout_seconds: int = 900
    poll_interval_seconds: int = 15

@dataclass(frozen=True)
class PublishOutcome:
    state: Literal["published", "already_current"]
    generated_at: str
    pr_url: str | None
    merge_sha: str | None
```

The credential loader must use `os.lstat`, reject symlinks/non-regular files,
require owner UID and mode `0600`, accept only `GH_TOKEN`, and never include its
value in an exception.

- [ ] **Step 4: Run focused tests**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_publish_snapshot.py`

Expected: all Task 1 tests pass.

### Task 2: Dedicated clone and exact-path commit

**Files:**
- Modify: `scripts/pivots/ops/publish_snapshot.py`
- Modify: `scripts/pivots/tests/test_publish_snapshot.py`

**Interfaces:**
- Consumes: `PublishConfig` and validated source snapshot from Task 1.
- Produces: `_prepare_publisher_repo()`, `_stage_snapshot_commit()`, deterministic branch naming.

- [ ] **Step 1: Write failing git integration tests**

Use a temporary bare remote plus a temporary standalone clone. Assert:

```python
assert committed_paths == {
    "data/pivot_assets.live.json",
    "data/pivot_backtest.live.json",
    "data/pivot_derivatives_history.live.json",
}
```

Also assert dirty unrelated files fail before commit, missing sidecar leaves the
main sidecar intact, and equal/newer `origin/main` returns an idempotent no-op.

- [ ] **Step 2: Verify the tests fail**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_publish_snapshot.py -k 'publisher_repo or commit or current'`

- [ ] **Step 3: Implement clone preparation and scoped commit**

The implementation must:

```text
git fetch --prune origin main
git switch --detach origin/main
git switch -c automation/pivots-daily-<timestamp> origin/main
git add -- <allowlisted paths>
git commit --only -m <message> -- <allowlisted paths>
git diff-tree --no-commit-id --name-only -r HEAD
```

Reject any dirty pre-existing state or commit path outside the allowlist. The
public pair must both be present in a newly created publication commit.

- [ ] **Step 4: Run focused tests**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_publish_snapshot.py`

### Task 3: PR, checks, merge, and production smoke

**Files:**
- Modify: `scripts/pivots/ops/publish_snapshot.py`
- Modify: `scripts/pivots/tests/test_publish_snapshot.py`

**Interfaces:**
- Produces: `GitHubClient` methods `create_or_resume_pr()`, `wait_for_green()`, `squash_merge()`, `wait_for_vercel_production()`, and `cleanup_branch()`.
- Produces: `verify_public_production()` for radar, backtest, and page smoke.

- [ ] **Step 1: Write failing state-machine tests**

Cover these exact states:

```python
def test_wait_requires_guards_and_vercel_success(): ...
def test_failed_or_timed_out_check_never_merges(): ...
def test_closed_unmerged_existing_pr_fails(): ...
def test_merge_requires_merged_true_and_sha(): ...
def test_public_smoke_requires_expected_radar_timestamp(): ...
```

- [ ] **Step 2: Verify the tests fail**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_publish_snapshot.py -k 'green or merge or smoke or existing_pr'`

- [ ] **Step 3: Implement bounded GitHub and production state machines**

Create non-draft PRs, poll `gh pr view --json` until `guards` and `Vercel` are
successful, then merge through:

```text
gh api --method PUT repos/sition-jp/livemakers-site/pulls/<number>/merge \
  -f merge_method=squash -f commit_title=<title>
```

Poll the merge commit status until Vercel succeeds, then verify:

```text
GET /api/pivot-radar
GET /api/backtests?asset=BTC&horizon=7D&score_type=overall&threshold=70
GET /ja/turning-points
```

- [ ] **Step 4: Run focused tests**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_publish_snapshot.py`

### Task 4: Daily runner wiring and failure alerts

**Files:**
- Modify: `scripts/pivots/ops/run_daily.py`
- Modify: `scripts/pivots/tests/test_run_daily_autocommit.py`

**Interfaces:**
- Adds: `run_daily(..., auto_publish: bool = False)`.
- Adds CLI flag: `--auto-publish`.
- Adds subprocess boundary: `_invoke_publisher()` returning captured rc/output.

- [ ] **Step 1: Write failing runner wiring tests**

```python
def test_main_parses_auto_publish(): ...
def test_auto_publish_requires_auto_commit(): ...
def test_publisher_runs_only_after_successful_commit(): ...
def test_publish_failure_emits_failed_without_ok(): ...
def test_publish_success_details_reach_final_ok(): ...
```

- [ ] **Step 2: Verify the tests fail**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_run_daily_autocommit.py`

- [ ] **Step 3: Implement post-commit publication**

Invoke `python -m ops.publish_snapshot` only after local pipeline and auto-commit
success. Keep current side-effect failure semantics: log/Telegram FAILED,
preserve the previous production snapshot, and return exit 0 to launchd.

- [ ] **Step 4: Run runner tests**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_run_daily.py scripts/pivots/tests/test_run_daily_autocommit.py scripts/pivots/tests/test_autocommit_integration.py`

### Task 5: Runbook and install source of truth

**Files:**
- Modify: `scripts/pivots/RUNBOOK.md`
- Modify: `scripts/pivots/ops/samples/com.sition.livemakers.pivots.daily.plist`
- Modify: `scripts/pivots/ops/install_launchagent.sh`
- Create: `scripts/pivots/tests/test_install_launchagent.py`

**Interfaces:**
- Documents credential metadata, publisher clone, failure recovery, and rollback.
- Adds `--auto-publish` to the sample plist only; the installed plist remains unchanged until cutover.

- [ ] **Step 1: Add install-time metadata preflight**

Require the GitHub token file to be a regular, non-symlink, user-owned `0600`
file before installing an auto-publish plist. Do not print or parse the token in
the shell installer.

- [ ] **Step 2: Update runbook flow and failure matrix**

Replace the manual-push statement with the guarded publication state machine,
document `--auto-publish` as scheduled-only, and document rollback by removing
that flag and reinstalling.

- [ ] **Step 3: Verify plist and shell syntax**

Run: `plutil -lint scripts/pivots/ops/samples/com.sition.livemakers.pivots.daily.plist`

Run: `bash -n scripts/pivots/ops/install_launchagent.sh`

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_install_launchagent.py`

### Task 6: Full verification and review handoff

**Files:**
- Verify all files in this plan.

- [ ] **Step 1: Run Python suite with sidecar hash guard**

Record SHA-256 of `data/pivot_derivatives_history.live.json`, run:

`scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests`

Then require the SHA-256 to be unchanged.

- [ ] **Step 2: Run consumer and schema verification**

Run: `npx vitest run tests/pivots/output-snapshot-zod.validate.test.ts tests/api/pivot-radar.test.ts tests/api/pivot-scores.test.ts tests/api/backtests.test.ts`

Run: `npm run typecheck`

- [ ] **Step 3: Inspect exact diff and secret scan**

Run: `git diff --check`

Run: `git diff --name-status origin/main...HEAD`

Run: `git grep -nE '(ghp_|github_pat_|GH_TOKEN=.{8,})' -- . ':!docs/superpowers/plans/*'`

Expected: no secret values and no paths outside this plan.

- [ ] **Step 4: Commit logical changes and open a Draft PR**

Stage exact files only. The PR body must state that merge does not activate the
installed LaunchAgent and that cutover requires a separate explicit gate.
