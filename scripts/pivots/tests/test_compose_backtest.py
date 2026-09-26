import json
from pathlib import Path

import pytest

from producer.bulk_history import BulkHistory
from producer.compose_backtest import (
    MIN_HISTORY_COVERAGE,
    BacktestHistoryError,
    _DerivAtT,
    _historical_score,
    _precompute_asset_series,
    compose_pivot_backtest_snapshot,
)
from producer.fetch_binance import BinanceFetcher
from tests._bulk_fixture import synthetic_day_records

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "binance"
NOW_ISO = "2026-05-04T00:00:00Z"
_KLINES_START_MS = 1_638_316_800_000   # 2021-12-01 = BACKTEST_HISTORY_START_DAY; fixture は 1 頁で全部返る


@pytest.fixture
def fetcher() -> BinanceFetcher:
    canned = {
        # fetch_klines_range's default page_limit is now BINANCE_KLINES_MAX_LIMIT
        # (1000) -- Binance silently caps the real API at 1000 rows regardless of
        # what a caller asks for (see fetch_binance.py). The fixture has fewer
        # than 1000 candles, so this single canned page still satisfies the
        # "short page ends paging" check with no second request.
        f"https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime={_KLINES_START_MS}&limit=1000": (
            FIXTURE_DIR / "btcusdt_klines_1d_1500.json"
        ).read_bytes(),
        f"https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&startTime={_KLINES_START_MS}&limit=1000": (
            FIXTURE_DIR / "ethusdt_klines_1d_1500.json"
        ).read_bytes(),
    }
    return BinanceFetcher(http_get=lambda url: canned[url])


def _synthetic_history(symbol: str, klines_path: Path, *, drop_every: int | None = None) -> BulkHistory:
    """Six OI samples and three funding events per candle day; OI ramps 14-day-wise so the OI rule can fire."""
    rows = json.loads(klines_path.read_text())
    records = synthetic_day_records(rows, drop_every=drop_every)
    return BulkHistory(symbol, records)


@pytest.fixture
def history() -> dict:
    return {
        "BTC": _synthetic_history("BTCUSDT", FIXTURE_DIR / "btcusdt_klines_1d_1500.json"),
        "ETH": _synthetic_history("ETHUSDT", FIXTURE_DIR / "ethusdt_klines_1d_1500.json"),
    }


def test_backtest_emits_36_entries(fetcher: BinanceFetcher, history: dict) -> None:
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=history)
    assert snap["schema_version"] == "v0.1"
    assert snap["generated_at"] == NOW_ISO
    # 2 assets × 3 horizons × 3 score_types × 2 thresholds = 36
    assert len(snap["entries"]) == 36
    keys = {
        (e["asset"], e["horizon"], e["score_type"], e["threshold"])
        for e in snap["entries"]
    }
    expected = {
        (a, h, st, t)
        for a in ("BTC", "ETH")
        for h in ("7D", "30D", "90D")
        for st in ("overall", "price_pivot", "volatility_pivot")
        for t in (70, 80)
    }
    assert keys == expected


def test_backtest_metrics_shape(fetcher: BinanceFetcher, history: dict) -> None:
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=history)
    for e in snap["entries"]:
        m = e["metrics"]
        assert 0.0 <= m["precision"] <= 1.0
        assert 0.0 <= m["recall"] <= 1.0
        assert m["sample_size"] >= 0
        assert e["period"]["start"] != ""
        assert e["period"]["end"] != ""


def test_at_least_some_entries_have_nonzero_sample_size(
    fetcher: BinanceFetcher, history: dict
) -> None:
    """Real-history regression guard (Task 21): _historical_score() must still
    let scores actually cross thresholds 70/80 at SOME (asset, horizon,
    score_type, threshold) tuples now that OI growth/funding come from real
    bulk derivatives history instead of the removed backtest-only proxy. A
    return where every entry has sample_size=0 means the backtest pipeline
    is structurally inert and the Backtest UI is functionally empty.

    price_pivot never depended on OI/funding, so it is unaffected by the
    proxy removal and still fires on all 12 (asset × horizon × threshold)
    tuples on the test fixture.

    volatility_pivot's OI-conjunction rule requires real
    `price_range_compression` (< 0.05, matching the live producer — see
    compose_assets.py) AND real `oi_growth_pct` >= 0.10 at the SAME candle.
    On this ~13-month BTC/ETH fixture window (2025-03-31..2026-05-04), 30D
    range compression under 5% never occurs in either asset's real price
    data (crypto rarely shows that tight a 30D range) — the exact
    structural limit the pre-Task-21 proxy/loosened-threshold synthesis
    existed to paper over. Task 21 intentionally removes that synthesis, so
    volatility_pivot/overall legitimately produce sample_size=0 on this
    fixture; that is not a regression. This test only guards against the
    pipeline being structurally inert overall (price_pivot proves the real
    sliding-window context still reaches the scorer end to end).
    """
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=history)
    nonzero = [e for e in snap["entries"] if e["metrics"]["sample_size"] > 0]
    assert len(nonzero) >= 8, (
        f"only {len(nonzero)}/36 entries have sample_size > 0 — "
        f"backtest pipeline appears structurally inert"
    )

    # Per-score-type expectations.
    by_st: dict[str, list[int]] = {}
    for e in snap["entries"]:
        by_st.setdefault(e["score_type"], []).append(e["metrics"]["sample_size"])
    nz_pp = sum(1 for s in by_st["price_pivot"] if s > 0)
    assert nz_pp >= 8, (
        f"price_pivot fires on only {nz_pp}/12 tuples — pp scoring path looks broken"
    )


def test_backtest_fixture_has_at_least_one_nonzero_lead_time(
    fetcher: BinanceFetcher, history: dict
) -> None:
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=history)
    lead_times = [
        e["metrics"]["avg_lead_time_days"]
        for e in snap["entries"]
        if e["metrics"]["sample_size"] > 0
    ]
    assert any(x > 0 for x in lead_times), (
        "expected at least one fixture entry to have real lead-time metrics"
    )


def test_history_is_required(fetcher: BinanceFetcher) -> None:
    with pytest.raises(BacktestHistoryError, match="history"):
        compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=None)  # type: ignore[arg-type]


def test_insufficient_coverage_fails_closed(fetcher: BinanceFetcher) -> None:
    thin = {
        "BTC": _synthetic_history("BTCUSDT", FIXTURE_DIR / "btcusdt_klines_1d_1500.json", drop_every=5),   # 80% coverage
        "ETH": _synthetic_history("ETHUSDT", FIXTURE_DIR / "ethusdt_klines_1d_1500.json"),
    }
    with pytest.raises(BacktestHistoryError, match=f"{MIN_HISTORY_COVERAGE:.2f}"):
        compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=thin)


def test_snapshot_carries_data_provenance(fetcher: BinanceFetcher, history: dict) -> None:
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=history)
    prov = snap["data_provenance"]
    assert prov["source"] == "binance_public_bulk_metrics+fapi_funding"
    assert prov["start"] < prov["end"] and 0 < prov["coverage_pct"] <= 100


def test_metrics_use_worst_forward_return_key(fetcher: BinanceFetcher, history: dict) -> None:
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=history)
    m = snap["entries"][0]["metrics"]
    assert "worst_forward_return" in m and "max_drawdown" not in m


def test_missing_asset_history_fails_closed(fetcher: BinanceFetcher) -> None:
    """R18 guard: history missing an asset entirely must fail closed with a
    clear per-asset message, not a bare KeyError from `history[a]`."""
    history = {
        "BTC": _synthetic_history("BTCUSDT", FIXTURE_DIR / "btcusdt_klines_1d_1500.json"),
    }
    with pytest.raises(BacktestHistoryError, match="ETH"):
        compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=history)


def test_no_proxy_code_path_remains() -> None:
    src = (Path(__file__).parents[1] / "producer" / "compose_backtest.py").read_text()
    assert "oi_growth_proxy" not in src and "abs_funding_history\": [0.0001] * 50" not in src


def test_stale_klines_fail_closed(fetcher: BinanceFetcher, history: dict) -> None:
    """R19 guard: klines truncated by Binance's 1000-row cap (or any other
    fetch that ends far short of the run date) must fail closed, not silently
    backtest on a stale price series."""
    with pytest.raises(BacktestHistoryError, match="klines end"):
        compose_pivot_backtest_snapshot(
            fetcher, generated_at="2026-09-26T00:00:00Z", history=history
        )


def test_single_missing_walked_day_does_not_raise(fetcher: BinanceFetcher) -> None:
    """I1 regression: a single missing walked day (coverage still comfortably
    above MIN_HISTORY_COVERAGE) must not raise. hist.abs_funding_history()
    returns [] for a day with no cached record; _deriv_series' fallback used
    to be the single-element list [0.0], and percentiles.pct_rank raises
    "needs at least 2 points" for any series shorter than 2 — so a real-world
    single-day gap inside the walk window (not just a thin-coverage day)
    crashed the whole backtest. The fallback must carry >= 2 points (mid-rank
    0.5, so the funding rule simply cannot fire for that candle) instead."""
    rows = json.loads((FIXTURE_DIR / "btcusdt_klines_1d_1500.json").read_text())
    records = synthetic_day_records(rows)
    del records[200]  # one day inside the walk window (walk_start = max(60, ...))
    history = {
        "BTC": BulkHistory("BTCUSDT", records),
        "ETH": _synthetic_history("ETHUSDT", FIXTURE_DIR / "ethusdt_klines_1d_1500.json"),
    }
    snap = compose_pivot_backtest_snapshot(fetcher, generated_at=NOW_ISO, history=history)
    assert len(snap["entries"]) == 36


def test_funding_spike_raises_volatility_pivot_by_15() -> None:
    """I2 regression: prove real funding actually reaches the scorer (not
    just that the pipeline runs end to end). Holds price/volume/OI inputs
    fixed across two _historical_score calls and flips only abs_funding at
    a single candle t; score_volatility_pivot's top-20%-funding rule must
    add exactly +15 when funding is a spike against an otherwise-flat
    180-event history (pct_rank([0.0001]*180, 0.01) == 1.0, which is >= the
    0.80 top-pct threshold; the flat case ties the whole history and lands
    on the pct_rank mid-rank of 0.5, below threshold)."""
    rows = json.loads((FIXTURE_DIR / "btcusdt_klines_1d_1500.json").read_text())
    closes = [float(r[4]) for r in rows]
    highs = [float(r[2]) for r in rows]
    lows = [float(r[3]) for r in rows]
    volumes = [float(r[5]) for r in rows]
    series = _precompute_asset_series(closes, highs, lows)

    t = 300  # inside the walk window (well past every indicator's warmup)
    flat_history = [0.0001] * 180
    deriv_flat = [_DerivAtT(0.0, 0.0001, flat_history)] * len(closes)
    deriv_spike = list(deriv_flat)
    deriv_spike[t] = _DerivAtT(
        oi_growth_pct=0.0, abs_funding=0.01, abs_funding_history=flat_history
    )

    score_flat = _historical_score(
        closes, volumes, series, deriv_flat, t, "volatility_pivot", "30D"
    )
    score_spike = _historical_score(
        closes, volumes, series, deriv_spike, t, "volatility_pivot", "30D"
    )
    assert score_spike - score_flat == 15


def test_oi_growth_with_compression_adds_25() -> None:
    """I2 regression: prove real OI growth actually reaches the scorer.
    Builds a fully synthetic 200-candle series (no fixture splicing needed)
    whose last 30 days are flat within +/-0.4 around 100.0 so
    price_range_compression is True at t, then flips only oi_growth_pct at
    that single candle between two _historical_score calls.
    score_volatility_pivot's OI-growth-with-compression conjunction rule
    (oi_growth_pct >= 0.10 AND price_range_compression) must add exactly
    +25."""
    n = 200
    closes = [100.0 + i * 0.5 for i in range(170)]
    closes += [100.0 + (0.4 if i % 2 == 0 else -0.4) for i in range(170, n)]
    highs = [c * 1.01 for c in closes]
    lows = [c * 0.99 for c in closes]
    volumes = [1000.0] * n
    series = _precompute_asset_series(closes, highs, lows)

    t = n - 1
    recent = closes[t - 29 : t + 1]
    compression_ratio = (max(recent) - min(recent)) / (sum(recent) / 30)
    assert compression_ratio < 0.05  # precondition: compression rule is armed

    flat_history = [0.0001] * 180
    deriv_no_growth = [_DerivAtT(0.0, 0.0001, flat_history)] * n
    deriv_growth = list(deriv_no_growth)
    deriv_growth[t] = _DerivAtT(
        oi_growth_pct=0.15, abs_funding=0.0001, abs_funding_history=flat_history
    )

    score_no_growth = _historical_score(
        closes, volumes, series, deriv_no_growth, t, "volatility_pivot", "30D"
    )
    score_growth = _historical_score(
        closes, volumes, series, deriv_growth, t, "volatility_pivot", "30D"
    )
    assert score_growth - score_no_growth == 25
