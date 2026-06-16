# LiveMakersCom AI Turning Point Detector v0.3-1 REST-only Evidence Core Design

> Date: 2026-06-16
> Status: Design for review
> Product: LiveMakersCom AI Turning Point Detector
> Scope: v0.3 first slice, derivatives evidence only
> Positioning: SITION Market State Intelligence Engine evidence upgrade

## Context

v0.1-live is operating as a hidden beta on the production route:

```text
https://livemakers.com/turning-points
https://livemakers.com/ja/turning-points
```

v0.2 Quality Core has been merged and production-verified. It upgraded the
producer's backtest quality layer with ATR/RV-relative hit definitions, real
lead-time metrics, and backtest-derived confidence quality while preserving the
existing materialized JSON contract.

The next useful slice is not public navigation or broad asset expansion. The
current BTC/ETH radar still needs stronger market-state evidence before it
should be framed as a public product surface or reused as Auto Trader context.
The first v0.3 slice therefore adds safer derivatives context without changing
the public schema or operational shape.

Relevant current constraints:

- `pivot_assets.live.json` and `pivot_backtest.live.json` still emit
  `schema_version: "v0.1"`.
- `lib/pivots/types.ts` limits score types to `overall`, `price_pivot`, and
  `volatility_pivot`.
- Evidence categories are currently limited to `price`, `volatility`,
  `volume`, `oi`, `funding`, and `confidence`.
- The existing producer already fetches public Binance OHLCV, Open Interest,
  and funding data.
- Binance liquidation data is stream-oriented through `forceOrder`; it is not a
  good fit for a once-daily REST-only producer slice.

Provider references used for this design:

- Binance USD-M Futures Market Data REST API:
  `https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api`
- Open Interest Statistics:
  `https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest-Statistics`
- Funding Rate History:
  `https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-History`
- Long/Short Ratio:
  `https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Long-Short-Ratio`
- USD-M Futures Liquidation WebSocket streams:
  `https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/All-Market-Liquidation-Order-Streams`

## Goal

Add REST-only derivatives evidence that helps answer:

```text
Are positioning, funding, and leverage-context conditions becoming crowded or
unstable enough to increase turning-point or volatility-expansion sensitivity?
```

This slice should improve evidence quality and future extensibility while
keeping the daily producer stable.

## Non-Goals

- No Header/nav public link.
- No schema version bump.
- No new `ScoreType`.
- No new zod evidence category in this slice.
- No real liquidation collector.
- No WebSocket daemon, background process, database, or sidecar cache.
- No paid/provider-key dependency.
- No direct AI Auto Trader execution signal.
- No SDE ingestion path.
- No ADA/NIGHT support.
- No ML tuning.
- No change to the scheduled LaunchAgent cadence.

## Considered Approaches

### A. REST-only Evidence Core

Use public REST derivatives endpoints already compatible with the daily producer
model: Open Interest, funding, and long/short positioning ratios. Treat
liquidation as a risk proxy, not observed liquidation data.

Pros:
- Smallest operational blast radius.
- No new secret.
- No long-running process.
- Compatible with current daily snapshot workflow.
- Gives LiveMakersCom, SDE, and future Auto Trader a cleaner derivatives
  evidence boundary.

Cons:
- Does not observe actual liquidation prints.
- Historical depth remains limited by public endpoint retention windows.
- Evidence can improve before backtest calibration catches up.

### B. WebSocket Liquidation Collector

Add a small collector for Binance `forceOrder` liquidation streams and persist
observed liquidation events.

Pros:
- Captures true liquidation flow.
- Enables richer liquidation cluster and squeeze-risk metrics.

Cons:
- Adds a new always-on process.
- Introduces restart gaps, persistence, retention, monitoring, and recovery
  questions.
- Larger ops surface before the evidence contract is settled.

### C. External Liquidation Provider

Use a provider with historical liquidation data.

Pros:
- Better historical liquidation coverage if provider quality is high.
- May support backtest integration sooner.

Cons:
- Adds cost, API keys, provider lock-in, usage terms, and secret handling.
- Not necessary for the first derivatives evidence slice.

## Decision

Use Approach A.

This slice is named:

```text
turning-points-v0.3-1-rest-only-evidence-core
```

It is an evidence upgrade, not a scoring-model or public-surface launch.

## Design

### 1. Preserve the Materialized JSON Contract

The emitted JSON shape remains unchanged:

- Keep `schema_version: "v0.1"` in both materialized snapshots.
- Do not change `lib/pivots/types.ts` in this slice.
- Do not add `liquidation` or `derivatives` to `EvidenceCategorySchema` in this
  slice.
- Do not add a new `derivatives_pivot` score type.
- Do not change `/api/pivot-radar`, `/api/pivot-scores`, or `/api/backtests`
  response shapes.

Derivatives evidence should use existing categories:

| Evidence meaning | Existing category |
|---|---|
| Open Interest expansion or contraction | `oi` |
| Funding skew or crowding | `funding` |
| Long/short crowding and squeeze sensitivity | `volatility` |

The evidence message must make the limitation clear. It can say "liquidation
sensitivity" or "positioning crowding"; it must not say "liquidations detected"
unless true liquidation data exists.

### 2. Required REST Data

Keep existing inputs:

- Daily OHLCV klines
- Open Interest history
- Funding rate history

Add REST-only positioning inputs:

- Global long/short account ratio
- Top trader long/short position ratio

Optional implementation discovery may also add top trader long/short account
ratio if the official endpoint is stable and fixtures remain small. Taker
buy/sell ratio is not required for this slice.

All required inputs must be public/auth-less. The producer must not require API
keys for this slice.

### 3. Fetcher Boundary

Extend `producer.fetch_binance.BinanceFetcher` with small, typed methods rather
than embedding URL logic inside scoring code.

Suggested new value types:

```python
@dataclass(frozen=True)
class LongShortRatioPoint:
    timestamp: int
    long_short_ratio: float
    long_account: float | None
    short_account: float | None

@dataclass(frozen=True)
class TopTraderPositionRatioPoint:
    timestamp: int
    long_short_ratio: float
    long_account: float | None
    short_account: float | None
```

Suggested methods:

```python
fetch_global_long_short_ratio(asset, period="1d", limit=30)
fetch_top_trader_long_short_position_ratio(asset, period="1d", limit=30)
```

Implementation may use `period="4h"` if that aligns better with existing OI
granularity, but daily snapshots should aggregate to the same logical daily
market-state context.

### 4. Normalized Derivatives Context

Add a focused context helper, separate from price and volatility scoring:

```python
class DerivativesEvidenceContext(TypedDict):
    oi_growth_pct: float
    oi_growth_history: list[float]
    abs_funding: float
    abs_funding_history: list[float]
    global_long_short_ratio: float | None
    global_long_short_ratio_history: list[float]
    top_trader_position_ratio: float | None
    top_trader_position_ratio_history: list[float]
    price_range_compression: bool
    data_completeness: float
```

The helper should be understandable without reading the whole producer:

```python
score_derivatives_evidence(ctx) -> tuple[int, list[EvidenceItem]]
```

The score is internal for ranking evidence only in v0.3-1. It should not be
wired into `overall`, `price_pivot`, `volatility_pivot`, or confidence until a
later slice explicitly designs that calibration.

### 5. Evidence Rules

Initial rules should be intentionally simple and explainable:

- OI grew materially while price remained range-bound:
  - category: `oi`
  - direction: `volatility`
  - message: "Open Interest expanded while price stayed range-bound"

- Funding skew is high versus recent history:
  - category: `funding`
  - direction: `volatility`
  - message: "Funding is skewed versus recent history"

- Global long/short ratio is crowded and near its lookback extreme:
  - category: `volatility`
  - direction: `volatility`
  - message: "Long/short positioning is crowded, increasing squeeze sensitivity"

- Top trader position ratio diverges from global positioning:
  - category: `volatility`
  - direction: `volatility`
  - message: "Top trader positioning diverges from broader account positioning"

Evidence should only be emitted when the condition is strong enough to be
useful. Low-signal normal readings should not add filler evidence.

### 6. Score Impact

v0.3-1 is evidence-only.

Do not change:

- `overall`
- `price_pivot`
- `volatility_pivot`
- `confidence.score`
- `confidence.grade`
- backtest metrics

Rationale:

- REST-only positioning evidence has short public history and no direct
  liquidation prints.
- Existing backtest quality does not yet benchmark these new features.
- Keeping scores stable makes it easier to observe whether new evidence is
  useful before it becomes part of the score.

If implementation pressure makes "evidence-only" awkward, the fallback is to
append derivatives evidence after existing price/volatility evidence in
`compose_assets`, still without changing scores.

### 7. Liquidation Language

This slice may use the phrase:

```text
liquidation risk proxy
```

It must not imply observed liquidation data.

Allowed:

- "Positioning is crowded, which can increase liquidation sensitivity."
- "Derivatives conditions suggest higher squeeze sensitivity."
- "Liquidation risk proxy is elevated."

Not allowed:

- "Liquidations increased."
- "Liquidation clusters detected."
- "Forced selling was observed."

Those require WebSocket or external provider data and belong to a later slice.

### 8. Data Flow

Target live producer flow:

```text
fetch klines / OI / funding
-> fetch global long-short ratio / top trader position ratio
-> build price and volatility contexts
-> compute existing price and volatility scores
-> compute derivatives evidence context
-> append high-signal derivatives evidence using existing categories
-> compute unchanged confidence and overall scores
-> emit unchanged pivot_assets.live.json schema
-> emit unchanged pivot_backtest.live.json schema
```

Backtest flow remains unchanged in this slice.

### 9. Failure Handling

New REST positioning endpoints are optional evidence inputs.

If long/short ratio endpoints fail:

- Do not fail the daily producer.
- Continue with existing OHLCV/OI/funding behavior.
- Emit no long/short evidence for that asset/horizon.
- Keep snapshot validation unchanged.

If existing core fetches fail, current producer failure behavior remains in
force. v0.3-1 should not weaken the current ops safety model.

### 10. Backtest Policy

Do not wire long/short or liquidation-risk proxy data into
`pivot_backtest.live.json` in v0.3-1.

Reason:

- The current public derivatives REST windows are short.
- A five-year historical benchmark needs either a persistent sidecar cache or a
  provider with deeper history.
- v0.2 backtest quality should remain the current quality baseline until the
  data history problem is solved explicitly.

### 11. Testing

Add focused tests without broad UI churn:

- Fetcher URL/parse tests for global long/short and top trader position ratios.
- Unit tests for `score_derivatives_evidence`.
- A compose-assets regression proving strong derivatives context appends
  evidence using existing categories.
- A failure-path test proving optional long/short fetch failure does not fail
  snapshot composition.
- Existing Python producer tests still pass.
- Existing zod snapshot validation still passes.

Required verification commands:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest
.venv/bin/python -m producer.run_producer --dry-run

cd /Users/sition/Documents/SITION/DEV/livemakers-site
npx vitest run tests/pivots/output-snapshot-zod.validate.test.ts
```

### 12. Operational Safety

No LaunchAgent change is required.

No new secrets are allowed.

No change to auto-commit path scope is required.

Provider calls should stay inside the existing daily producer run and should
avoid retry loops that can make the LaunchAgent hang. A single short-timeout
request per optional endpoint is enough for v0.3-1.

### 13. Rollback

Rollback is simple:

- Revert the v0.3-1 implementation commit.
- Continue v0.2 daily snapshots.
- No migration is required because the materialized JSON contract is unchanged.

## Acceptance Criteria

The slice is complete when:

- Materialized JSON schema remains `v0.1`.
- No zod schema or API response shape change is required.
- No new secret is required.
- No WebSocket collector is introduced.
- Existing scores remain unchanged when comparing the same base market inputs
  with derivatives evidence disabled.
- Strong fixture derivatives conditions append at least one evidence item using
  existing categories.
- Optional long/short fetch failure does not fail snapshot composition.
- Python producer tests pass.
- `producer.run_producer --dry-run` exits 0.
- Existing zod snapshot validation passes.
- Public navigation remains unchanged.

## Implementation Defaults

The implementation plan should use these defaults unless code discovery proves
one unsafe:

- Add new fetcher methods in `producer.fetch_binance`.
- Add a new focused scorer module such as
  `producer.score_derivatives_evidence`.
- Keep derivatives evidence out of backtest output.
- Keep derivatives evidence out of score math.
- Append derivatives evidence after existing price/volatility evidence.
- Use existing evidence categories only.
- Treat liquidation as a proxy term only.
- Keep all changes inside the Python producer and producer tests unless zod
  validation reveals a real contract issue.
