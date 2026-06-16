# Turning Points v0.3-1 REST-only Evidence Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public REST-only derivatives positioning evidence to the AI Turning Point producer without changing the materialized JSON schema, scores, confidence, backtest output, UI, API routes, or scheduled ops.

**Architecture:** Extend the existing Binance fetcher with auth-less long/short ratio endpoints, add a focused derivatives evidence scorer, and append high-signal evidence inside `compose_assets`. New positioning endpoints are optional inputs: failures produce no new derivatives evidence but must not fail the daily snapshot.

**Tech Stack:** Python 3.12 stdlib, pytest, existing `livemakers-pivots-producer`, Next.js/Vitest zod snapshot validation. No new runtime dependency and no new secret.

---

## Scope And Guardrails

Implementation repo:

```text
/Users/sition/Documents/SITION/DEV/livemakers-site
```

Design source:

```text
docs/pivots/2026-06-16-turning-points-v0.3-1-rest-only-evidence-core-design.md
```

Do not edit:

- `lib/pivots/types.ts`
- `app/[locale]/turning-points/**`
- `app/api/{pivot-radar,pivot-scores,backtests}/**`
- `components/turning-points/**`
- `scripts/pivots/producer/compose_backtest.py`
- `scripts/pivots/producer/backtest.py`
- `scripts/pivots/producer/backtest_quality.py`
- `data/pivot_assets.live.json`
- `data/pivot_backtest.live.json`
- `scripts/pivots/ops/**`
- `scripts/pivots/RUNBOOK.md`

Do not run a live write during implementation:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m producer.run_producer --dry-run
```

No `git add .`. Stage explicit paths only.

Implementation should start only after PR #8 design review is accepted. If PR
#8 is not merged yet, branch from `codex-turning-points-v0.3-1-design` so the
design doc remains in the implementation branch. If PR #8 has been merged,
branch from latest `main`.

## File Structure

Modify:

- `scripts/pivots/producer/fetch_binance.py`
  Add typed REST fetchers for global long/short account ratio and top trader
  long/short position ratio.

- `scripts/pivots/producer/compose_assets.py`
  Load optional long/short ratio data, build a derivatives evidence context, and
  append derivatives evidence without changing scores.

- `scripts/pivots/tests/test_fetch_binance.py`
  Add URL and parse coverage for the new fetcher methods.

- `scripts/pivots/tests/test_compose_assets.py`
  Add regression tests for evidence append, score stability, and optional
  endpoint failure.

Create:

- `scripts/pivots/producer/score_derivatives_evidence.py`
  Focused scorer that converts normalized derivatives context into internal
  score plus `EvidenceItem` rows using existing categories only.

- `scripts/pivots/tests/test_score_derivatives_evidence.py`
  Unit tests for high-signal and low-signal derivatives evidence behavior.

Do not create:

- new JSON snapshot files
- sidecar cache files
- launchd jobs
- provider secret files
- WebSocket collectors

## Task 0: Execution Preflight

**Files:**
- Read only: repository state

- [ ] **Step 1: Inspect current branch and status**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git status --short --branch
git log --oneline --decorate -5
```

Expected if starting before PR #8 is merged:

```text
## codex-turning-points-v0.3-1-design...origin/codex-turning-points-v0.3-1-design
544d25a (HEAD -> codex-turning-points-v0.3-1-design, origin/codex-turning-points-v0.3-1-design) docs(pivots): design v0.3 rest-only evidence core
```

Expected if starting after PR #8 is merged:

```text
## main...origin/main
```

- [ ] **Step 2: Create implementation branch**

If PR #8 is not merged:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git switch codex-turning-points-v0.3-1-design
git switch -c codex-turning-points-v0.3-1-rest-evidence
```

If PR #8 is merged:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git switch main
git pull --ff-only origin main
git switch -c codex-turning-points-v0.3-1-rest-evidence
```

Expected:

```text
Switched to a new branch 'codex-turning-points-v0.3-1-rest-evidence'
```

## Task 1: Binance Long/Short REST Fetchers

**Files:**
- Modify: `scripts/pivots/producer/fetch_binance.py`
- Test: `scripts/pivots/tests/test_fetch_binance.py`

- [ ] **Step 1: Add failing fetcher tests**

Append this to `scripts/pivots/tests/test_fetch_binance.py` and update the
import block to include the new dataclasses:

```python
from producer.fetch_binance import (
    BinanceFetcher,
    Candle,
    FundingPoint,
    LongShortRatioPoint,
    OpenInterestPoint,
    TopTraderPositionRatioPoint,
)


def test_fetch_global_long_short_ratio_returns_typed_points() -> None:
    captured: list[str] = []
    payload = json.dumps([
        {
            "symbol": "BTCUSDT",
            "longAccount": "0.6250",
            "longShortRatio": "1.6667",
            "shortAccount": "0.3750",
            "timestamp": "1717200000000",
        }
    ]).encode()

    def _http_get(url: str) -> bytes:
        captured.append(url)
        return payload

    pts = BinanceFetcher(http_get=_http_get).fetch_global_long_short_ratio(
        "BTC", period="1d", limit=30
    )

    assert captured == [
        "https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
        "?symbol=BTCUSDT&period=1d&limit=30"
    ]
    assert pts == [
        LongShortRatioPoint(
            timestamp=1717200000000,
            long_short_ratio=1.6667,
            long_account=0.6250,
            short_account=0.3750,
        )
    ]


def test_fetch_top_trader_position_ratio_returns_typed_points() -> None:
    captured: list[str] = []
    payload = json.dumps([
        {
            "symbol": "ETHUSDT",
            "longAccount": "0.7000",
            "longShortRatio": "2.3333",
            "shortAccount": "0.3000",
            "timestamp": "1717200000000",
        }
    ]).encode()

    def _http_get(url: str) -> bytes:
        captured.append(url)
        return payload

    pts = BinanceFetcher(http_get=_http_get).fetch_top_trader_long_short_position_ratio(
        "ETH", period="1d", limit=30
    )

    assert captured == [
        "https://fapi.binance.com/futures/data/topLongShortPositionRatio"
        "?symbol=ETHUSDT&period=1d&limit=30"
    ]
    assert pts == [
        TopTraderPositionRatioPoint(
            timestamp=1717200000000,
            long_short_ratio=2.3333,
            long_account=0.7000,
            short_account=0.3000,
        )
    ]
```

- [ ] **Step 2: Run fetcher tests and verify failure**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_fetch_binance.py -q
```

Expected:

```text
ImportError or AttributeError mentioning LongShortRatioPoint,
TopTraderPositionRatioPoint, or missing fetch_*long_short* method
```

- [ ] **Step 3: Implement typed long/short fetchers**

In `scripts/pivots/producer/fetch_binance.py`, update the module docstring
endpoint list:

```python
"""Binance public REST clients for OHLCV / Open Interest / Funding.

All endpoints used here are documented public + free + auth-less:
- spot klines:             https://api.binance.com/api/v3/klines
- futures OI:              https://fapi.binance.com/futures/data/openInterestHist
- futures funding:         https://fapi.binance.com/fapi/v1/fundingRate
- global long/short ratio: https://fapi.binance.com/futures/data/globalLongShortAccountRatio
- top trader position:     https://fapi.binance.com/futures/data/topLongShortPositionRatio

The fetcher takes an injectable http_get callable so tests can inject
recorded bytes; production passes the default urllib-based client.
"""
```

Add the dataclasses after `FundingPoint`:

```python
@dataclass(frozen=True)
class LongShortRatioPoint:
    timestamp: int  # ms epoch
    long_short_ratio: float
    long_account: float | None
    short_account: float | None


@dataclass(frozen=True)
class TopTraderPositionRatioPoint:
    timestamp: int  # ms epoch
    long_short_ratio: float
    long_account: float | None
    short_account: float | None
```

Add this helper before `class BinanceFetcher`:

```python
def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    return float(value)
```

Add these methods to `BinanceFetcher`:

```python
    def fetch_global_long_short_ratio(
        self,
        asset: AssetSymbol,
        period: Literal["1d", "4h", "1h"] = "1d",
        limit: int = 30,
    ) -> list[LongShortRatioPoint]:
        symbol = self._resolve(asset)
        url = (
            f"https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
            f"?symbol={symbol}&period={period}&limit={limit}"
        )
        raw = json.loads(self._http_get(url))
        return [
            LongShortRatioPoint(
                timestamp=int(r["timestamp"]),
                long_short_ratio=float(r["longShortRatio"]),
                long_account=_optional_float(r.get("longAccount")),
                short_account=_optional_float(r.get("shortAccount")),
            )
            for r in raw
        ]

    def fetch_top_trader_long_short_position_ratio(
        self,
        asset: AssetSymbol,
        period: Literal["1d", "4h", "1h"] = "1d",
        limit: int = 30,
    ) -> list[TopTraderPositionRatioPoint]:
        symbol = self._resolve(asset)
        url = (
            f"https://fapi.binance.com/futures/data/topLongShortPositionRatio"
            f"?symbol={symbol}&period={period}&limit={limit}"
        )
        raw = json.loads(self._http_get(url))
        return [
            TopTraderPositionRatioPoint(
                timestamp=int(r["timestamp"]),
                long_short_ratio=float(r["longShortRatio"]),
                long_account=_optional_float(r.get("longAccount")),
                short_account=_optional_float(r.get("shortAccount")),
            )
            for r in raw
        ]
```

- [ ] **Step 4: Run fetcher tests and verify pass**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_fetch_binance.py -q
```

Expected:

```text
7 passed
```

- [ ] **Step 5: Commit fetcher work**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git status --short
git add scripts/pivots/producer/fetch_binance.py scripts/pivots/tests/test_fetch_binance.py
git commit -m "feat(pivots): fetch derivatives positioning ratios"
```

Expected:

```text
[codex-turning-points-v0.3-1-rest-evidence <sha>] feat(pivots): fetch derivatives positioning ratios
```

## Task 2: Derivatives Evidence Scorer

**Files:**
- Create: `scripts/pivots/producer/score_derivatives_evidence.py`
- Create: `scripts/pivots/tests/test_score_derivatives_evidence.py`

- [ ] **Step 1: Add failing scorer tests**

Create `scripts/pivots/tests/test_score_derivatives_evidence.py`:

```python
from producer.score_derivatives_evidence import score_derivatives_evidence


def base_context(**overrides):
    ctx = {
        "oi_growth_pct": 0.0,
        "oi_growth_history": [0.0, 0.02, 0.03, 0.04],
        "abs_funding": 0.0001,
        "abs_funding_history": [0.0001, 0.0002, 0.0003, 0.0004],
        "global_long_short_ratio": None,
        "global_long_short_ratio_history": [],
        "top_trader_position_ratio": None,
        "top_trader_position_ratio_history": [],
        "price_range_compression": False,
        "data_completeness": 100.0,
    }
    ctx.update(overrides)
    return ctx


def test_score_derivatives_evidence_emits_oi_crowding_evidence() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(oi_growth_pct=0.18, price_range_compression=True)
    )

    assert score > 0
    assert evidence == [
        {
            "category": "oi",
            "direction": "volatility",
            "weight": 0.25,
            "message": "Open Interest expanded while price stayed range-bound",
            "raw_value": 0.18,
        }
    ]


def test_score_derivatives_evidence_emits_funding_skew_evidence() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(
            abs_funding=0.0010,
            abs_funding_history=[0.0001, 0.0002, 0.0003, 0.0004, 0.0010],
        )
    )

    assert score > 0
    assert evidence[0]["category"] == "funding"
    assert evidence[0]["message"] == "Funding is skewed versus recent history"
    assert evidence[0]["raw_value"] == 0.0010


def test_score_derivatives_evidence_emits_crowded_long_short_evidence() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(
            global_long_short_ratio=2.4,
            global_long_short_ratio_history=[0.9, 1.0, 1.1, 1.2, 2.4],
        )
    )

    assert score > 0
    assert evidence[0]["category"] == "volatility"
    assert evidence[0]["message"] == (
        "Long/short positioning is crowded, increasing squeeze sensitivity"
    )
    assert evidence[0]["raw_value"] == 2.4


def test_score_derivatives_evidence_emits_top_trader_divergence_evidence() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(
            global_long_short_ratio=2.2,
            global_long_short_ratio_history=[1.0, 1.2, 1.4, 1.6, 2.2],
            top_trader_position_ratio=1.2,
            top_trader_position_ratio_history=[1.1, 1.1, 1.2, 1.2, 1.2],
        )
    )

    messages = {item["message"] for item in evidence}
    assert score > 0
    assert "Top trader positioning diverges from broader account positioning" in messages


def test_score_derivatives_evidence_omits_low_signal_normal_readings() -> None:
    score, evidence = score_derivatives_evidence(
        base_context(
            oi_growth_pct=0.03,
            price_range_compression=True,
            abs_funding=0.0002,
            abs_funding_history=[0.0001, 0.0002, 0.0003, 0.0004],
            global_long_short_ratio=1.1,
            global_long_short_ratio_history=[1.0, 1.1, 1.2, 1.3],
            top_trader_position_ratio=1.15,
            top_trader_position_ratio_history=[1.1, 1.15, 1.2],
        )
    )

    assert score == 0
    assert evidence == []
```

- [ ] **Step 2: Run scorer tests and verify failure**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_score_derivatives_evidence.py -q
```

Expected:

```text
ModuleNotFoundError: No module named 'producer.score_derivatives_evidence'
```

- [ ] **Step 3: Implement scorer module**

Create `scripts/pivots/producer/score_derivatives_evidence.py`:

```python
"""REST-only derivatives evidence scorer.

v0.3-1 is evidence-only: this module returns an internal score for ranking and
testing, but compose_assets must not wire it into overall, confidence, or
backtest metrics.
"""
from __future__ import annotations

import math
from typing import TypedDict

from producer.percentiles import is_in_bottom_pct, is_in_top_pct
from producer.types import EvidenceItem

OI_GROWTH_THRESHOLD = 0.10
LONG_SHORT_CROWDING_RATIO = 1.8
TOP_TRADER_DIVERGENCE_RATIO = 1.35


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


def _has_percentile_history(series: list[float]) -> bool:
    return len(series) >= 2


def _is_crowded_ratio(ratio: float | None, history: list[float]) -> bool:
    if ratio is None or ratio <= 0 or not _has_percentile_history(history):
        return False
    if ratio >= LONG_SHORT_CROWDING_RATIO:
        return is_in_top_pct(history, ratio, 0.20)
    if ratio <= 1.0 / LONG_SHORT_CROWDING_RATIO:
        return is_in_bottom_pct(history, ratio, 0.20)
    return False


def _is_top_trader_divergent(
    global_ratio: float | None,
    top_trader_ratio: float | None,
) -> bool:
    if (
        global_ratio is None
        or top_trader_ratio is None
        or global_ratio <= 0
        or top_trader_ratio <= 0
    ):
        return False
    return abs(math.log(top_trader_ratio / global_ratio)) >= math.log(
        TOP_TRADER_DIVERGENCE_RATIO
    )


def score_derivatives_evidence(
    ctx: DerivativesEvidenceContext,
) -> tuple[int, list[EvidenceItem]]:
    score = 0
    evidence: list[EvidenceItem] = []

    if (
        ctx["oi_growth_pct"] >= OI_GROWTH_THRESHOLD
        and ctx["price_range_compression"]
    ):
        score += 30
        evidence.append({
            "category": "oi",
            "direction": "volatility",
            "weight": 0.25,
            "message": "Open Interest expanded while price stayed range-bound",
            "raw_value": ctx["oi_growth_pct"],
        })

    if _has_percentile_history(ctx["abs_funding_history"]) and is_in_top_pct(
        ctx["abs_funding_history"], ctx["abs_funding"], 0.20
    ):
        score += 20
        evidence.append({
            "category": "funding",
            "direction": "volatility",
            "weight": 0.15,
            "message": "Funding is skewed versus recent history",
            "raw_value": ctx["abs_funding"],
        })

    global_ratio = ctx["global_long_short_ratio"]
    if _is_crowded_ratio(global_ratio, ctx["global_long_short_ratio_history"]):
        score += 25
        evidence.append({
            "category": "volatility",
            "direction": "volatility",
            "weight": 0.20,
            "message": "Long/short positioning is crowded, increasing squeeze sensitivity",
            "raw_value": global_ratio,
        })

    top_ratio = ctx["top_trader_position_ratio"]
    if _is_top_trader_divergent(global_ratio, top_ratio):
        score += 25
        evidence.append({
            "category": "volatility",
            "direction": "volatility",
            "weight": 0.20,
            "message": "Top trader positioning diverges from broader account positioning",
            "raw_value": top_ratio,
        })

    return min(score, 100), evidence
```

- [ ] **Step 4: Run scorer tests and verify pass**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_score_derivatives_evidence.py -q
```

Expected:

```text
5 passed
```

- [ ] **Step 5: Commit scorer work**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git add scripts/pivots/producer/score_derivatives_evidence.py scripts/pivots/tests/test_score_derivatives_evidence.py
git commit -m "feat(pivots): score derivatives evidence"
```

Expected:

```text
[codex-turning-points-v0.3-1-rest-evidence <sha>] feat(pivots): score derivatives evidence
```

## Task 3: Compose Assets Wiring

**Files:**
- Modify: `scripts/pivots/producer/compose_assets.py`
- Test: `scripts/pivots/tests/test_compose_assets.py`

- [ ] **Step 1: Add failing compose tests**

Append these helpers and tests to `scripts/pivots/tests/test_compose_assets.py`:

```python
def _core_canned() -> dict[str, bytes]:
    return {
        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1500": (
            FIXTURE_DIR / "btcusdt_klines_1d_1500.json"
        ).read_bytes(),
        "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=1500": (
            FIXTURE_DIR / "ethusdt_klines_1d_1500.json"
        ).read_bytes(),
        "https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=4h&limit=180": (
            FIXTURE_DIR / "btcusdt_oi_4h_180.json"
        ).read_bytes(),
        "https://fapi.binance.com/futures/data/openInterestHist?symbol=ETHUSDT&period=4h&limit=180": (
            FIXTURE_DIR / "ethusdt_oi_4h_180.json"
        ).read_bytes(),
        "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1000": (
            FIXTURE_DIR / "btcusdt_funding_1000.json"
        ).read_bytes(),
        "https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&limit=1000": (
            FIXTURE_DIR / "ethusdt_funding_1000.json"
        ).read_bytes(),
    }


def _ratio_payload(values: list[float]) -> bytes:
    rows = [
        {
            "symbol": "BTCUSDT",
            "longAccount": "0.7000",
            "shortAccount": "0.3000",
            "longShortRatio": f"{value:.4f}",
            "timestamp": str(1717200000000 + i * 86_400_000),
        }
        for i, value in enumerate(values)
    ]
    return json.dumps(rows).encode()


def test_snapshot_appends_derivatives_evidence_without_changing_scores() -> None:
    core = _core_canned()
    base = compose_pivot_assets_snapshot(
        BinanceFetcher(http_get=lambda url: core[url]),
        generated_at=NOW_ISO,
    )

    rich_canned = dict(core)
    for symbol in ("BTCUSDT", "ETHUSDT"):
        rich_canned[
            "https://fapi.binance.com/futures/data/globalLongShortAccountRatio"
            f"?symbol={symbol}&period=1d&limit=30"
        ] = _ratio_payload([1.0, 1.1, 1.2, 1.4, 2.4])
        rich_canned[
            "https://fapi.binance.com/futures/data/topLongShortPositionRatio"
            f"?symbol={symbol}&period=1d&limit=30"
        ] = _ratio_payload([1.0, 1.1, 1.2, 1.2, 1.2])

    rich = compose_pivot_assets_snapshot(
        BinanceFetcher(http_get=lambda url: rich_canned[url]),
        generated_at=NOW_ISO,
    )

    for key in base["detail"]:
        assert rich["detail"][key]["scores"] == base["detail"][key]["scores"]

    btc_7d_messages = {
        item["message"] for item in rich["detail"]["BTC__7D"]["evidence"]
    }
    btc_7d_all_messages = [
        item["message"] for item in rich["detail"]["BTC__7D"]["evidence"]
    ]
    assert len(btc_7d_all_messages) == len(set(btc_7d_all_messages))
    assert (
        "Long/short positioning is crowded, increasing squeeze sensitivity"
        in btc_7d_messages
    )
    assert (
        "Top trader positioning diverges from broader account positioning"
        in btc_7d_messages
    )


def test_optional_long_short_failure_does_not_fail_snapshot() -> None:
    core = _core_canned()

    def _http_get(url: str) -> bytes:
        if "LongShort" in url or "topLongShort" in url:
            raise OSError("optional endpoint down")
        return core[url]

    snap = compose_pivot_assets_snapshot(
        BinanceFetcher(http_get=_http_get),
        generated_at=NOW_ISO,
    )

    assert snap["schema_version"] == "v0.1"
    assert set(snap["detail"]) == {
        "BTC__7D",
        "BTC__30D",
        "BTC__90D",
        "ETH__7D",
        "ETH__30D",
        "ETH__90D",
    }
```

- [ ] **Step 2: Run compose tests and verify failure**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_compose_assets.py -q
```

Expected:

```text
FAIL because optional long/short fetches are not wired and derivatives evidence messages are absent
```

- [ ] **Step 3: Wire optional derivatives data into compose_assets**

In `scripts/pivots/producer/compose_assets.py`, add imports:

```python
from producer.score_derivatives_evidence import (
    DerivativesEvidenceContext,
    score_derivatives_evidence,
)
```

Update `_AssetData`:

```python
@dataclass
class _AssetData:
    closes: list[float]
    highs: list[float]
    lows: list[float]
    volumes: list[float]
    oi: list[float]
    funding: list[float]
    global_long_short_ratio: list[float]
    top_trader_position_ratio: list[float]
    last_close_time: int
```

Add this helper above `_load`:

```python
def _ratio_values(points) -> list[float]:
    return [p.long_short_ratio for p in points if p.long_short_ratio > 0]


def _append_unique_evidence(
    base: list,
    extra: list,
) -> list:
    seen = {(item["category"], item["message"]) for item in base}
    out = list(base)
    for item in extra:
        key = (item["category"], item["message"])
        if key not in seen:
            out.append(item)
            seen.add(key)
    return out
```

Replace `_load` with:

```python
def _load(fetcher: BinanceFetcher, asset: AssetSymbol) -> _AssetData:
    klines = fetcher.fetch_klines(asset, interval="1d", limit=1500)
    # 4h × 180 fully covers Binance's 30-day OI lookback cap.
    oi = fetcher.fetch_open_interest(asset, period="4h", limit=180)
    funding = fetcher.fetch_funding(asset, limit=1000)

    try:
        global_long_short = fetcher.fetch_global_long_short_ratio(
            asset, period="1d", limit=30
        )
    except Exception:
        global_long_short = []

    try:
        top_trader_position = fetcher.fetch_top_trader_long_short_position_ratio(
            asset, period="1d", limit=30
        )
    except Exception:
        top_trader_position = []

    return _AssetData(
        closes=[c.close for c in klines],
        highs=[c.high for c in klines],
        lows=[c.low for c in klines],
        volumes=[c.volume for c in klines],
        oi=[p.open_interest for p in oi],
        funding=[p.funding_rate for p in funding],
        global_long_short_ratio=_ratio_values(global_long_short),
        top_trader_position_ratio=_ratio_values(top_trader_position),
        last_close_time=klines[-1].close_time,
    )
```

Add this context builder below `_build_volatility_context`:

```python
def _build_derivatives_context(
    data: _AssetData,
    vol_ctx: VolatilityContext,
) -> DerivativesEvidenceContext:
    global_history = data.global_long_short_ratio[-30:]
    top_history = data.top_trader_position_ratio[-30:]
    available_inputs = sum(
        1
        for present in (
            bool(data.oi),
            bool(data.funding),
            bool(global_history),
            bool(top_history),
        )
        if present
    )
    return {
        "oi_growth_pct": vol_ctx["oi_growth_pct"],
        "oi_growth_history": [],
        "abs_funding": vol_ctx["abs_funding"],
        "abs_funding_history": vol_ctx["abs_funding_history"],
        "global_long_short_ratio": global_history[-1] if global_history else None,
        "global_long_short_ratio_history": global_history,
        "top_trader_position_ratio": top_history[-1] if top_history else None,
        "top_trader_position_ratio_history": top_history,
        "price_range_compression": vol_ctx["price_range_compression"],
        "data_completeness": available_inputs / 4.0 * 100.0,
    }
```

In `_build_detail`, replace the volatility/evidence block with:

```python
    pp_score, pp_evidence = score_price_pivot(_build_market_context(data, horizon))
    vol_ctx = _build_volatility_context(data, horizon)
    vp_score, vp_evidence = score_volatility_pivot(vol_ctx)
    _, derivatives_evidence = score_derivatives_evidence(
        _build_derivatives_context(data, vol_ctx)
    )
```

Replace evidence assembly:

```python
    evidence = _append_unique_evidence(pp_evidence + vp_evidence, derivatives_evidence)
```

Do not use the derivatives score in `overall`, confidence, direction bias, or
radar scores.

- [ ] **Step 4: Run compose tests and verify pass**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest tests/test_compose_assets.py -q
```

Expected:

```text
7 passed
```

- [ ] **Step 5: Commit compose wiring**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git add scripts/pivots/producer/compose_assets.py scripts/pivots/tests/test_compose_assets.py
git commit -m "feat(pivots): append derivatives evidence"
```

Expected:

```text
[codex-turning-points-v0.3-1-rest-evidence <sha>] feat(pivots): append derivatives evidence
```

## Task 4: Full Validation

**Files:**
- Read only: producer tests, emitted dry-run payloads, zod validator

- [ ] **Step 1: Run focused producer tests**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest \
  tests/test_fetch_binance.py \
  tests/test_score_derivatives_evidence.py \
  tests/test_compose_assets.py \
  -q
```

Expected:

```text
all selected tests pass
```

- [ ] **Step 2: Run full pivots Python tests**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m pytest
```

Expected:

```text
all tests pass
```

If `test_run_daily_lock.py` fails only because a borrowed pytest environment
does not propagate `multiprocessing.Event`, record that as an environment-only
known issue and rerun the focused producer tests from Step 1.

- [ ] **Step 3: Run producer dry-run**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site/scripts/pivots
.venv/bin/python -m producer.run_producer --dry-run
```

Expected:

```text
dry-run exits 0
```

Do not run the daily live writer.

- [ ] **Step 4: Run zod snapshot validation**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
npx vitest run tests/pivots/output-snapshot-zod.validate.test.ts
```

Expected:

```text
2 passed
```

- [ ] **Step 5: Confirm no forbidden files changed**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git status --short
git diff --name-only origin/main...HEAD
```

Expected changed paths only:

```text
docs/pivots/2026-06-16-turning-points-v0.3-1-rest-only-evidence-core-design.md
scripts/pivots/producer/fetch_binance.py
scripts/pivots/producer/score_derivatives_evidence.py
scripts/pivots/producer/compose_assets.py
scripts/pivots/tests/test_fetch_binance.py
scripts/pivots/tests/test_score_derivatives_evidence.py
scripts/pivots/tests/test_compose_assets.py
```

If this plan file is included in the implementation PR, also expect:

```text
docs/superpowers/plans/2026-06-16-turning-points-v0.3-1-rest-only-evidence-core-implementation-plan.md
```

## Task 5: Draft PR Handoff

**Files:**
- Read only: git diff and test output

- [ ] **Step 1: Push branch**

Run:

```bash
cd /Users/sition/Documents/SITION/DEV/livemakers-site
git push -u origin codex-turning-points-v0.3-1-rest-evidence
```

Expected:

```text
new branch pushed
```

- [ ] **Step 2: Open Draft PR**

Create a Draft PR against `main` with title:

```text
[codex] feat(pivots): add REST-only derivatives evidence
```

Use this body:

```markdown
## Summary

- Adds auth-less Binance long/short ratio fetchers.
- Adds a focused derivatives evidence scorer.
- Appends high-signal derivatives evidence to pivot asset details without changing scores, confidence, backtest output, schema, API routes, UI, or nav.

## Scope

v0.3-1 REST-only Evidence Core. This is evidence-only and does not include a WebSocket liquidation collector, paid provider, new secret, sidecar cache, or Auto Trader execution signal.

## Validation

- `cd scripts/pivots && .venv/bin/python -m pytest`
- `cd scripts/pivots && .venv/bin/python -m producer.run_producer --dry-run`
- `npx vitest run tests/pivots/output-snapshot-zod.validate.test.ts`
```

- [ ] **Step 3: Final PR review checklist**

Before requesting review, confirm:

```text
No change to lib/pivots/types.ts
No change to data/pivot_assets.live.json
No change to data/pivot_backtest.live.json
No change to app/api/*
No change to app/[locale]/turning-points/*
No change to components/turning-points/*
No new secret
No WebSocket collector
No LaunchAgent change
```
