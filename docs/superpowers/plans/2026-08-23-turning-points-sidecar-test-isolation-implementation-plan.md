# AI Turning Point Sidecar Test Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Python producer tests with custom snapshot targets from reading or rewriting the checkout's canonical derivatives sidecar.

**Architecture:** Treat an omitted sidecar argument as co-located with the explicitly supplied assets target. The CLI continues passing the canonical production sidecar explicitly, so runtime behavior is unchanged while temporary/custom callers become isolated by construction.

**Tech Stack:** Python 3.11+, pathlib, pytest, existing Binance fixtures.

**Spec:** Bounded fix approved with `docs/pivots/2026-08-23-turning-points-zero-touch-production-publisher-design.md` section 7; this PR is independent and contains no publisher code.

## Global Constraints

- Production CLI target paths and generated schemas remain unchanged.
- Tests must not modify `data/pivot_derivatives_history.live.json`.
- No scoring, source, API, UI, nav, LaunchAgent, or publishing behavior changes.
- The fix must cover future direct callers, not only current test call sites.

---

### Task 1: Reproduce and lock the path-isolation invariant

**Files:**
- Modify: `scripts/pivots/tests/test_run_producer.py`

**Interfaces:**
- Consumes: current `run_producer(fetcher, assets_path, backtest_path, derivatives_history_path=...)`.
- Produces: regression coverage proving omitted sidecar paths stay beside custom assets.

- [ ] **Step 1: Write a failing regression test**

```python
def test_custom_targets_do_not_touch_canonical_sidecar(
    tmp_path: Path,
    canned_fetcher: BinanceFetcher,
) -> None:
    canonical = Path(run_producer_module.DEFAULT_DERIVATIVES_HISTORY)
    before = canonical.read_bytes()
    assets = tmp_path / "pivot_assets.live.json"
    backtest = tmp_path / "pivot_backtest.live.json"

    rc = run_producer(
        fetcher=canned_fetcher,
        assets_path=assets,
        backtest_path=backtest,
        dry_run=False,
        skip_zod_validate=True,
    )

    assert rc == 0
    assert canonical.read_bytes() == before
    assert (tmp_path / "pivot_derivatives_history.live.json").exists()
```

- [ ] **Step 2: Run the test and verify root-cause failure**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_run_producer.py::test_custom_targets_do_not_touch_canonical_sidecar`

Expected: canonical sidecar bytes change and the temporary sidecar is absent.
Restore the canonical file from git immediately after this intentional RED run.

### Task 2: Derive the omitted sidecar from the custom assets path

**Files:**
- Modify: `scripts/pivots/producer/run_producer.py`
- Modify: `scripts/pivots/tests/test_run_producer.py`

**Interfaces:**
- Changes: `derivatives_history_path: Path | None = None`.
- Rule: `None` resolves to `assets_path.with_name(DEFAULT_DERIVATIVES_HISTORY.name)`.
- CLI: continues passing `args.derivatives_history_path` explicitly.

- [ ] **Step 1: Implement the minimum path resolution**

At the start of `run_producer()` add:

```python
if derivatives_history_path is None:
    derivatives_history_path = assets_path.with_name(
        DEFAULT_DERIVATIVES_HISTORY.name
    )
```

Do not change the CLI parser default.

- [ ] **Step 2: Run the regression test**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_run_producer.py::test_custom_targets_do_not_touch_canonical_sidecar`

Expected: pass, temporary sidecar exists, canonical bytes unchanged.

- [ ] **Step 3: Run the full producer test file**

Run: `scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests/test_run_producer.py`

Expected: all tests pass without modifying the canonical sidecar.

### Task 3: Full regression and commit hygiene

**Files:**
- Verify: `scripts/pivots/producer/run_producer.py`
- Verify: `scripts/pivots/tests/test_run_producer.py`
- Track: this implementation plan.

- [ ] **Step 1: Hash-guard the complete Python suite**

Record SHA-256 of `data/pivot_derivatives_history.live.json`, run:

`scripts/pivots/.venv/bin/pytest -q scripts/pivots/tests`

Require the post-suite SHA-256 to match.

- [ ] **Step 2: Run static diff checks**

Run: `git diff --check`

Run: `git diff --name-status origin/main...HEAD`

Expected: only this plan, `run_producer.py`, and `test_run_producer.py`.

- [ ] **Step 3: Commit and open a Draft PR**

Stage the three exact files. The PR body must include the pre-fix reproduction,
post-fix hash evidence, and confirmation that the production CLI explicitly
retains the canonical sidecar target.
