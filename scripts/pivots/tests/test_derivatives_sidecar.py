import json
import sys
from copy import deepcopy
from pathlib import Path

import pytest

from producer.derivatives_sidecar import (
    SCHEMA_VERSION,
    SidecarValidationError,
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
    with pytest.raises(ValueError):
        load_derivatives_history_sidecar(invalid)

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


def _day_fetcher(
    oi_count: int, funding_count: int, offset: float = 0,
    funding_rate: float = 0.0001,
) -> _Fetcher:
    return _Fetcher(
        oi={
            asset: [
                OpenInterestPoint(ms(0, h * 4), 100 + h + offset, 1000 + h + offset)
                for h in range(oi_count)
            ]
            for asset in ("BTC", "ETH")
        },
        funding={
            asset: [FundingPoint(ms(0, h * 8), funding_rate) for h in range(funding_count)]
            for asset in ("BTC", "ETH")
        },
    )


@pytest.mark.parametrize("remaining_oi", [0, 1, 5])
def test_later_funding_fetch_cannot_erase_or_reduce_saved_oi(remaining_oi) -> None:
    existing = compose_derivatives_history_sidecar(
        _day_fetcher(6, 1), "2025-12-20T23:00:00Z"
    )
    before = deepcopy(existing)
    result = compose_derivatives_history_sidecar(
        _day_fetcher(remaining_oi, 3, offset=900),
        "2026-01-20T23:00:00Z",
        existing=existing,
    )
    for asset in ("BTC", "ETH"):
        row = result["assets"][asset]["history"][0]
        assert row["open_interest"]["sample_count"] == 6
        assert row["open_interest"]["avg"] == 102.5
        assert row["funding"]["sample_count"] == 3
        assert row["completeness"] == {
            "open_interest": 1.0, "funding": 1.0, "overall": 1.0
        }
    assert existing == before
    assert compose_derivatives_history_sidecar(
        _day_fetcher(remaining_oi, 3, offset=900),
        "2026-01-20T23:00:00Z",
        existing=result,
    ) == result


@pytest.mark.parametrize("remaining_funding", [0, 1, 2])
def test_later_oi_fetch_preserves_more_complete_saved_funding(remaining_funding) -> None:
    existing = compose_derivatives_history_sidecar(
        _day_fetcher(1, 3), "2025-12-20T23:00:00Z"
    )
    result = compose_derivatives_history_sidecar(
        _day_fetcher(6, remaining_funding),
        "2025-12-21T23:00:00Z",
        existing=existing,
    )
    row = result["assets"]["BTC"]["history"][0]
    assert row["open_interest"]["sample_count"] == 6
    assert row["funding"]["sample_count"] == 3
    assert row["funding"]["sum"] == 0.0003
    assert row["completeness"]["overall"] == 1.0


@pytest.mark.parametrize("existing_count", [1, 6])
def test_at_least_as_complete_observations_refresh_values(existing_count) -> None:
    existing = compose_derivatives_history_sidecar(
        _day_fetcher(existing_count, 3), "2025-12-20T23:00:00Z"
    )
    result = compose_derivatives_history_sidecar(
        _day_fetcher(6, 3, offset=10, funding_rate=0.0002),
        "2025-12-21T23:00:00Z",
        existing=existing,
    )
    row = result["assets"]["BTC"]["history"][0]
    assert row["open_interest"]["sample_count"] == 6
    assert row["open_interest"]["avg"] == 112.5
    assert row["funding"]["sum"] == 0.0006
    assert row["completeness"]["overall"] == 1.0


def _saved_snapshot() -> dict:
    return compose_derivatives_history_sidecar(
        _day_fetcher(6, 3), "2025-12-20T23:00:00Z"
    )


@pytest.mark.parametrize("family,field,value", [
    ("open_interest", "sample_count", "6"),
    ("open_interest", "sample_count", True),
    ("open_interest", "sample_count", 6.0),
    ("open_interest", "sample_count", -1),
    ("open_interest", "sample_count", 7),
    ("funding", "sample_count", 4),
    ("funding", "sample_count", None),
    ("open_interest", "avg", float("nan")),
    ("funding", "last", float("inf")),
    ("open_interest", "avg_usd", True),
])
def test_retained_invalid_aggregate_is_rejected_before_fetch(
    tmp_path, family, field, value,
) -> None:
    saved = _saved_snapshot()
    saved["assets"]["BTC"]["history"][0][family][field] = value
    path = tmp_path / "history.json"
    raw = json.dumps(saved).encode()
    path.write_bytes(raw)

    with pytest.raises(ValueError, match=r"BTC.*" + family):
        load_derivatives_history_sidecar(path)
    assert path.read_bytes() == raw

    # Direct compose callers must not bypass validation or discard bad old rows
    # just because those rows fall outside this fetch/retention window.
    fetcher = _Fetcher({}, {})
    with pytest.raises(ValueError, match=r"BTC.*" + family):
        compose_derivatives_history_sidecar(
            fetcher, "2026-03-01T23:00:00Z", existing=saved, retention_days=1,
        )


@pytest.mark.parametrize("damage", [
    "missing_funding", "missing_oi_field", "missing_asset", "unknown_asset",
    "wrong_schema", "wrong_provider", "wrong_symbol", "invalid_generated_at",
    "naive_generated_at", "invalid_bucket", "open_bucket", "duplicate_bucket",
    "bad_source", "bad_completeness", "extra_row_field",
])
def test_structural_damage_never_becomes_an_empty_history(tmp_path, damage) -> None:
    saved = _saved_snapshot()
    row = saved["assets"]["BTC"]["history"][0]
    if damage == "missing_funding":
        del row["funding"]
    elif damage == "missing_oi_field":
        del row["open_interest"]["avg"]
    elif damage == "missing_asset":
        del saved["assets"]["ETH"]
    elif damage == "unknown_asset":
        saved["assets"]["SOL"] = {"symbol": "SOLUSDT", "history": []}
    elif damage == "wrong_schema":
        saved["schema_version"] = "pivots_derivatives_history.v99"
    elif damage == "wrong_provider":
        saved["provider"] = "other"
    elif damage == "wrong_symbol":
        saved["assets"]["BTC"]["symbol"] = "ETHUSDT"
    elif damage == "invalid_generated_at":
        saved["generated_at"] = "not-a-date"
    elif damage == "naive_generated_at":
        saved["generated_at"] = "2025-12-20T23:00:00"
    elif damage == "invalid_bucket":
        row["bucket_end"] = "2025-12-21T00:00:00Z"
    elif damage == "open_bucket":
        saved["generated_at"] = "2025-12-18T23:00:00Z"
    elif damage == "duplicate_bucket":
        saved["assets"]["BTC"]["history"].append(deepcopy(row))
    elif damage == "bad_source":
        row["source"]["is_closed_bucket"] = False
    elif damage == "bad_completeness":
        row["completeness"]["overall"] = 0
    elif damage == "extra_row_field":
        row["unknown_history"] = [1, 2, 3]
    raw = json.dumps(saved).encode()
    path = tmp_path / "history.json"
    path.write_bytes(raw)
    with pytest.raises(ValueError):
        load_derivatives_history_sidecar(path)
    assert path.read_bytes() == raw


@pytest.mark.parametrize("raw", [b"{", b"null", b"[]", b"\xff"])
def test_existing_invalid_bytes_are_not_treated_as_missing(tmp_path, raw) -> None:
    path = tmp_path / "history.json"
    path.write_bytes(raw)
    with pytest.raises(ValueError):
        load_derivatives_history_sidecar(path)
    assert path.read_bytes() == raw


def test_duplicate_json_keys_are_not_silently_overwritten(tmp_path) -> None:
    raw = json.dumps(_saved_snapshot()).replace(
        '"schema_version":', '"schema_version": "wrong", "schema_version":', 1,
    ).encode()
    path = tmp_path / "history.json"
    path.write_bytes(raw)
    with pytest.raises(ValueError, match="duplicate"):
        load_derivatives_history_sidecar(path)
    assert path.read_bytes() == raw


def test_unreadable_existing_sidecar_is_not_treated_as_missing(tmp_path) -> None:
    with pytest.raises(ValueError, match="read"):
        load_derivatives_history_sidecar(tmp_path)


def test_dangling_sidecar_symlink_is_not_treated_as_first_run(tmp_path) -> None:
    path = tmp_path / "history.json"
    path.symlink_to(tmp_path / "missing-target.json")
    with pytest.raises(ValueError):
        load_derivatives_history_sidecar(path)
    assert path.is_symlink()
    assert not path.exists()


@pytest.mark.parametrize("family", ["open_interest", "funding"])
def test_duplicate_timestamps_count_once_without_changing_aggregates(family) -> None:
    fetcher = _day_fetcher(6, 3)
    points = fetcher.oi if family == "open_interest" else fetcher.funding
    for asset in ("BTC", "ETH"):
        points[asset] = list(reversed(points[asset] + [points[asset][0]] * 3))
    result = compose_derivatives_history_sidecar(fetcher, "2025-12-20T23:00:00Z")
    row = result["assets"]["BTC"]["history"][0]
    assert row["open_interest"]["sample_count"] == 6
    assert row["open_interest"]["avg"] == 102.5
    assert row["open_interest"]["growth_pct"] == 0.05
    assert row["funding"]["sample_count"] == 3
    assert row["funding"]["sum"] == 0.0003
    assert row["completeness"]["overall"] == 1.0


@pytest.mark.parametrize("family", ["open_interest", "oi_usd", "funding"])
def test_conflicting_duplicate_timestamp_is_not_arbitrarily_selected(family) -> None:
    fetcher = _day_fetcher(1, 1)
    if family == "funding":
        fetcher.funding["BTC"].append(FundingPoint(ms(0, 0), 0.123))
    else:
        fetcher.oi["BTC"].append(OpenInterestPoint(
            ms(0, 0), 999 if family == "open_interest" else 100,
            9999 if family == "oi_usd" else 1000,
        ))
    with pytest.raises(ValueError, match="conflicting"):
        compose_derivatives_history_sidecar(fetcher, "2025-12-20T23:00:00Z")


@pytest.mark.parametrize("family", ["open_interest", "funding"])
def test_too_many_unique_samples_are_not_reported_as_complete(family) -> None:
    fetcher = _day_fetcher(6, 3)
    if family == "open_interest":
        fetcher.oi["BTC"].append(OpenInterestPoint(ms(0, 1), 200, 2000))
    else:
        fetcher.funding["BTC"].append(FundingPoint(ms(0, 1), 0.0001))
    with pytest.raises(ValueError, match="sample"):
        compose_derivatives_history_sidecar(fetcher, "2025-12-20T23:00:00Z")


def test_valid_saved_history_survives_a_sliding_fetch_window(tmp_path) -> None:
    saved = _saved_snapshot()
    path = tmp_path / "history.json"
    path.write_text(json.dumps(saved))
    loaded = load_derivatives_history_sidecar(path)
    assert loaded == saved
    fetcher = _Fetcher(
        {asset: [OpenInterestPoint(ms(40, 0), 200, 2000)] for asset in ("BTC", "ETH")},
        {asset: [FundingPoint(ms(40, 0), 0.0002)] for asset in ("BTC", "ETH")},
    )
    result = compose_derivatives_history_sidecar(
        fetcher, "2026-01-29T23:00:00Z", existing=loaded,
    )
    for asset in ("BTC", "ETH"):
        history = result["assets"][asset]["history"]
        assert [row["bucket_start"] for row in history] == [
            "2025-12-18T00:00:00Z", "2026-01-27T00:00:00Z",
        ]
        assert history[0] == saved["assets"][asset]["history"][0]
        assert history[1]["open_interest"]["sample_count"] == 1
    assert loaded == saved


def test_constant_decimal_oi_is_not_rejected_for_sum_rounding(tmp_path) -> None:
    fetcher = _day_fetcher(6, 3)
    for asset in ("BTC", "ETH"):
        fetcher.oi[asset] = [
            OpenInterestPoint(ms(0, hour), 3046968.324, 10000000.0)
            for hour in (0, 4, 8, 12, 16, 20)
        ]
    snapshot = compose_derivatives_history_sidecar(fetcher, "2025-12-20T23:00:00Z")
    oi = snapshot["assets"]["BTC"]["history"][0]["open_interest"]
    assert oi["sample_count"] == 6
    assert oi["min"] == oi["max"] == 3046968.324
    assert oi["avg"] == pytest.approx(3046968.324, rel=0, abs=1e-9)
    path = tmp_path / "history.json"
    path.write_text(json.dumps(snapshot))
    assert load_derivatives_history_sidecar(path) == snapshot


@pytest.mark.parametrize("avg,valid", [
    (3046968.3239999996, True),
    (3046968.3240000004, True),
    (3046968.314, False),
    (3046968.334, False),
])
def test_saved_oi_bounds_tolerate_only_floating_point_noise(tmp_path, avg, valid) -> None:
    snapshot = _saved_snapshot()
    oi = snapshot["assets"]["BTC"]["history"][0]["open_interest"]
    oi.update(first=3046968.324, last=3046968.324, min=3046968.324,
              max=3046968.324, avg=avg, growth_pct=0.0)
    path = tmp_path / "history.json"
    raw = json.dumps(snapshot).encode()
    path.write_bytes(raw)
    if valid:
        assert load_derivatives_history_sidecar(path) == snapshot
    else:
        with pytest.raises(SidecarValidationError, match="bounds"):
            load_derivatives_history_sidecar(path)
    assert path.read_bytes() == raw


@pytest.mark.parametrize("case", ["huge-integer", "deep-nesting", "utf16"])
def test_decoder_failures_use_the_controlled_validation_error(tmp_path, case) -> None:
    if case == "huge-integer":
        digits = max(4300, sys.get_int_max_str_digits()) + 1
        raw = json.dumps(_saved_snapshot()).replace(
            '"sample_count": 6', '"sample_count": ' + "9" * digits, 1,
        ).encode()
    elif case == "deep-nesting":
        raw = b"[" * 10000 + b"]" * 10000
    else:
        raw = json.dumps(_saved_snapshot()).encode("utf-16")
    path = tmp_path / "history.json"
    path.write_bytes(raw)
    with pytest.raises(SidecarValidationError, match="parse"):
        load_derivatives_history_sidecar(path)
    assert path.read_bytes() == raw
