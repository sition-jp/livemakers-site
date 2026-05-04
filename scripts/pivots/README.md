# LiveMakersCom AI Turning Point Detector v0.1 — Producer

Python producer that materializes `data/pivot_assets.live.json` and
`data/pivot_backtest.live.json`. Phase 1 (consumer) is frozen; this package
must satisfy the zod schema in `lib/pivots/types.ts` without any
consumer-side changes.

## Setup

```bash
cd scripts/pivots
python3.11 -m venv .venv  # or python3.12 if 3.11 unavailable; pyproject requires >=3.11
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -e ".[dev]"
.venv/bin/pytest --version  # 8.3.3
```

The `[dev]` extra pulls in pytest. There are no runtime dependencies — the
producer is pure Python stdlib.

## Run (dry-run, no file replacement; still runs the zod validator)

```bash
.venv/bin/python -m producer.run_producer --dry-run
```

## Run (live, atomic two-file promotion with .bak rollback)

```bash
.venv/bin/python -m producer.run_producer
```

The producer:

1. Refuses to run if orphan `*.bak` files exist (operator must resolve first
   — see Recovery section below).
2. Fetches BTC + ETH OHLCV / Open Interest / Funding from public Binance
   endpoints (no auth, no API key).
3. Computes Price Pivot, Volatility Pivot, Direction Bias, Confidence,
   Evidence per PRD §13–17.
4. Runs the v0.1 backtest (PRD §18–19; provisional simplified contexts).
5. Writes both snapshots to `*.tmp` (fsync), runs the Vitest zod validator
   against the tmps, then promotes both files via a backup-and-rollback
   dance so consumers never see an inconsistent pair.

## Tests

```bash
cd scripts/pivots
.venv/bin/pytest -v
```

## Recovering from orphan `*.bak`

If a previous run crashed mid-promotion you may find leftover
`data/pivot_*.live.json.bak` files. The producer refuses to run until they
are resolved. Compare against the current target and either:

```bash
# Promote .bak forward (the .bak was the "good" state):
mv data/pivot_assets.live.json.bak data/pivot_assets.live.json

# OR keep the current target and discard the .bak:
rm data/pivot_assets.live.json.bak
```

Then re-run the producer.

## Schedule (suggested, not configured by this PR)

Once Phase 2 is reviewed, propose a daily 08:00 JST cron:

```
0 8 * * * cd /path/to/livemakers-site/scripts/pivots && .venv/bin/python -m producer.run_producer 2>&1 | logger -t pivots-producer
```

## Constraints honored by this package

- No edits to `lib/pivots/types.ts`, `lib/pivots/pivots-reader.ts`, any
  `app/[locale]/turning-points/**`, `app/api/{pivot-radar,pivot-scores,backtests}/**`,
  or `components/turning-points/**`.
- No new npm dependencies. The post-write zod validator runs as a Vitest
  test using libraries already in `package.json`.
- Targets `data/pivot_*.live.json` are promoted in pairs with `.bak`
  rollback: any failure during promotion is rolled back, and any failure
  earlier in the pipeline leaves the previous good snapshots intact.
- Backtest is provisional v0.1 (simplified historical contexts;
  precision/recall numbers are a pipeline smoke test, not a tunable
  benchmark — see `producer/compose_backtest.py` module docstring).
