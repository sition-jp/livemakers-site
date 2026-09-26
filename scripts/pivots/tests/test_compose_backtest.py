import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from producer.bulk_history import BulkHistory, DayRecord
from producer.compose_backtest import (
    MIN_HISTORY_COVERAGE,
    BacktestHistoryError,
    compose_pivot_backtest_snapshot,
)
from producer.fetch_binance import BinanceFetcher

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "binance"
NOW_ISO = "2026-05-04T00:00:00Z"
_KLINES_START_MS = 1_638_316_800_000   # 2021-12-01 = BACKTEST_HISTORY_START_DAY; fixture は 1 頁で全部返る


@pytest.fixture
def fetcher() -> BinanceFetcher:
    canned = {
        f"https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime={_KLINES_START_MS}&limit=1500": (
            FIXTURE_DIR / "btcusdt_klines_1d_1500.json"
        ).read_bytes(),
        f"https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&startTime={_KLINES_START_MS}&limit=1500": (
            FIXTURE_DIR / "ethusdt_klines_1d_1500.json"
        ).read_bytes(),
    }
    return BinanceFetcher(http_get=lambda url: canned[url])


def _synthetic_history(symbol: str, klines_path: Path, *, drop_every: int | None = None) -> BulkHistory:
    """Six OI samples and three funding events per candle day; OI ramps 14-day-wise so the OI rule can fire."""
    rows = json.loads(klines_path.read_text())
    records = []
    for i, row in enumerate(rows):
        day = datetime.fromtimestamp(row[0] / 1000, tz=timezone.utc)
        d = day.strftime("%Y-%m-%d")
        if drop_every and i % drop_every == 0:
            continue
        base = 1000.0 * (1.0 + 0.15 * ((i // 14) % 2))
        oi = tuple((int((day + timedelta(hours=h)).timestamp() * 1000), base, base * 2) for h in (0, 4, 8, 12, 16, 20))
        fu = tuple((int((day + timedelta(hours=h)).timestamp() * 1000), 0.0001 if i % 40 else 0.001) for h in (0, 8, 16))
        records.append(DayRecord(day=d, oi=oi, funding=fu))
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


def test_no_proxy_code_path_remains() -> None:
    src = (Path(__file__).parents[1] / "producer" / "compose_backtest.py").read_text()
    assert "oi_growth_proxy" not in src and "abs_funding_history\": [0.0001] * 50" not in src
