# v0.1-Ops Production-Like Smoke Checklist

Run through this list once before declaring v0.1-ops complete. Tick each
item. If any item fails, do not declare v0.1-ops complete.

## Producer pipeline

- [ ] `cd scripts/pivots && .venv/bin/python -m producer.run_producer --dry-run`
      → exit 0, zod validator 2/2 passed, "dry-run wrote …" output
- [ ] `cd scripts/pivots && .venv/bin/python -m producer.run_producer`
      → exit 0, real `data/pivot_*.live.json` files updated
- [ ] `cd scripts/pivots && .venv/bin/python -m ops.run_daily`
      → exit 0, `data/pivots-history/` populated, `scripts/pivots/ops.log.jsonl`
        appended with `status: OK`
- [ ] Run `ops.run_daily` 8 times in a row (e.g. with `for i in {1..8}; do …`),
      then verify `data/pivots-history/` keeps only 7 newest of each basename

## Consumer pipeline (from npm run dev)

- [ ] GET `/api/pivot-radar` returns populated radar
- [ ] GET `/api/pivot-scores?asset=BTC&horizon=30D` returns detail object
- [ ] GET `/api/backtests?asset=BTC&horizon=30D&score_type=price_pivot&threshold=70`
      returns metrics
- [ ] `/en/turning-points` renders, Freshness shows "fresh" badge for
      just-written snapshot
- [ ] `/en/turning-points/btc?h=30D` renders, Freshness present
- [ ] `/en/turning-points/backtest` renders, ProvisionalBacktestBanner present,
      Freshness present
- [ ] Same three pages render under `/ja/`

## Failure-mode degrades

- [ ] Stale: temporarily `touch -t 202604010000 data/pivot_assets.live.json`
      → page shows "stale" or "very stale" tier instead of "fresh"; revert
- [ ] Missing file: temporarily `mv data/pivot_assets.live.json /tmp/`
      → `/en/turning-points` renders the **empty / pre-launch state** (no
        `UnavailableNotice`, no alarming copy — the existing pivots-reader
        treats ENOENT as `fileExists:false` per Phase 1 design); restore
        the file
- [ ] Malformed file: temporarily write `echo '{"bad":1}' > data/pivot_assets.live.json`
      → `/en/turning-points` renders `UnavailableNotice` with parse error
        details (the schema-violation path is what triggers the alert
        component, not file absence); restore from a `data/pivots-history/`
        backup

## Mobile / Responsive

- [ ] All three pages usable at 375×667 viewport (iPhone SE)
- [ ] DisclaimerBanner + Freshness + ProvisionalBacktestBanner stack readably

## Alerting

- [ ] Trigger a known failure (e.g. set `LM_PIVOT_ASSETS_PATH` to a
      read-only path) and run `ops.run_daily` → log entry with
      `status: FAILED`, macOS notification visible
- [ ] Recovery: clear the failure, re-run `ops.run_daily` → log entry
      with `status: OK`, no macOS notification

---

> **Recording the completed checklist** (Codex review 2, should-fix):
> The completed, ticked checklist goes into the v0.1-ops PR as a comment
> (or attached as a log artifact in the PR description). It is **not**
> committed back into this file — the file in git remains a blank template
> so subsequent runs (e.g. v0.1-live, v0.2 regression) can re-use it
> without merging operator metadata into history.
