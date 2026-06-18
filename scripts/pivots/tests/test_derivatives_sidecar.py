from pathlib import Path

from producer.derivatives_sidecar import (
    SCHEMA_VERSION,
    compose_derivatives_history_sidecar,
    load_derivatives_history_sidecar,
)
from producer.fetch_binance import FundingPoint, OpenInterestPoint


class _Fetcher:
    def __init__(
        self,
        oi: dict[str, list[OpenInterestPoint]],
        funding: dict[str, list[FundingPoint]],
    ) -> None:
        self.oi = oi
        self.funding = funding

    def fetch_open_interest(self, asset, period="4h", limit=180):
        assert period == "4h"
        assert limit == 180
        return self.oi[asset]

    def fetch_funding(self, asset, limit=1000):
        assert limit == 1000
        return self.funding[asset]


def ms(day: int, hour: int) -> int:
    return 1_766_016_000_000 + (day * 86_400_000) + (hour * 3_600_000)


def test_sidecar_aggregates_closed_utc_days_only() -> None:
    generated_at = "2025-12-20T23:00:00Z"
    fetcher = _Fetcher(
        oi={
            "BTC": [
                OpenInterestPoint(ms(0, 0), 100.0, 1000.0),
                OpenInterestPoint(ms(0, 4), 110.0, 1100.0),
                OpenInterestPoint(ms(0, 8), 120.0, 1200.0),
                OpenInterestPoint(ms(2, 0), 999.0, 9990.0),
            ],
            "ETH": [
                OpenInterestPoint(ms(0, 0), 50.0, 500.0),
            ],
        },
        funding={
            "BTC": [
                FundingPoint(ms(0, 0), 0.0001),
                FundingPoint(ms(0, 8), -0.0002),
                FundingPoint(ms(0, 16), 0.0003),
                FundingPoint(ms(2, 0), 0.0999),
            ],
            "ETH": [
                FundingPoint(ms(0, 0), -0.0003),
            ],
        },
    )

    snap = compose_derivatives_history_sidecar(fetcher, generated_at)

    assert snap["schema_version"] == SCHEMA_VERSION
    assert snap["generated_at"] == generated_at
    assert snap["provider"] == "binance_usdm"
    btc_history = snap["assets"]["BTC"]["history"]
    assert [row["bucket_start"] for row in btc_history] == ["2025-12-18T00:00:00Z"]
    row = btc_history[0]
    assert row["bucket_end"] == "2025-12-19T00:00:00Z"
    assert row["open_interest"]["sample_count"] == 3
    assert row["open_interest"]["first"] == 100.0
    assert row["open_interest"]["last"] == 120.0
    assert row["open_interest"]["avg"] == 110.0
    assert row["open_interest"]["last_usd"] == 1200.0
    assert row["open_interest"]["avg_usd"] == 1100.0
    assert row["open_interest"]["growth_pct"] == 0.2
    assert row["funding"]["sample_count"] == 3
    assert row["funding"]["sum"] == 0.0002
    assert round(row["funding"]["avg"], 10) == round(0.0002 / 3, 10)
    assert row["funding"]["abs_avg"] == 0.0002
    assert row["funding"]["max_abs"] == 0.0003
    assert row["funding"]["last"] == 0.0003
    assert row["completeness"] == {
        "open_interest": 0.5,
        "funding": 1.0,
        "overall": 0.75,
    }
    assert row["source"]["is_closed_bucket"] is True


def test_sidecar_merges_existing_history_and_prunes_retention() -> None:
    generated_at = "2026-01-03T23:00:00Z"
    existing = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": "2026-01-02T23:00:00Z",
        "provider": "binance_usdm",
        "assets": {
            "BTC": {
                "symbol": "BTCUSDT",
                "history": [
                    {
                        "bucket_start": "2025-12-17T00:00:00Z",
                        "bucket_end": "2025-12-18T00:00:00Z",
                        "open_interest": {
                            "sample_count": 6,
                            "first": 1.0,
                            "last": 1.0,
                            "min": 1.0,
                            "max": 1.0,
                            "avg": 1.0,
                            "last_usd": 1.0,
                            "avg_usd": 1.0,
                            "growth_pct": 0.0,
                        },
                        "funding": {
                            "sample_count": 3,
                            "sum": 0.0,
                            "avg": 0.0,
                            "abs_avg": 0.0,
                            "max_abs": 0.0,
                            "last": 0.0,
                        },
                        "completeness": {
                            "open_interest": 1.0,
                            "funding": 1.0,
                            "overall": 1.0,
                        },
                        "source": {
                            "oi_period": "4h",
                            "funding_granularity": "8h",
                            "is_closed_bucket": True,
                        },
                    }
                ],
            },
            "ETH": {"symbol": "ETHUSDT", "history": []},
        },
    }
    fetcher = _Fetcher(
        oi={
            "BTC": [OpenInterestPoint(ms(0, 0), 10.0, 100.0)],
            "ETH": [OpenInterestPoint(ms(0, 0), 20.0, 200.0)],
        },
        funding={
            "BTC": [FundingPoint(ms(0, 0), 0.0001)],
            "ETH": [FundingPoint(ms(0, 0), 0.0002)],
        },
    )

    snap = compose_derivatives_history_sidecar(
        fetcher,
        generated_at,
        existing=existing,
        retention_days=1,
    )

    assert [r["bucket_start"] for r in snap["assets"]["BTC"]["history"]] == [
        "2025-12-18T00:00:00Z"
    ]
    assert [r["bucket_start"] for r in snap["assets"]["ETH"]["history"]] == [
        "2025-12-18T00:00:00Z"
    ]


def test_load_sidecar_missing_invalid_and_valid(tmp_path: Path) -> None:
    missing = tmp_path / "missing.json"
    assert load_derivatives_history_sidecar(missing) is None

    invalid = tmp_path / "invalid.json"
    invalid.write_text('{"schema_version": "wrong"}')
    assert load_derivatives_history_sidecar(invalid) is None

    valid = tmp_path / "valid.json"
    valid.write_text(
        '{"schema_version":"pivots_derivatives_history.v0.1",'
        '"generated_at":"2026-01-03T23:00:00Z",'
        '"provider":"binance_usdm",'
        '"assets":{"BTC":{"symbol":"BTCUSDT","history":[]},'
        '"ETH":{"symbol":"ETHUSDT","history":[]}}}'
    )
    loaded = load_derivatives_history_sidecar(valid)
    assert loaded is not None
    assert loaded["assets"]["BTC"]["history"] == []
