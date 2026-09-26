import inspect
import json
import os
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

import pytest

import producer.run_producer as run_producer_module
from producer.derivatives_sidecar import load_derivatives_history_sidecar
from producer.fetch_binance import BinanceFetcher
from producer.run_producer import run_producer
from tests._bulk_fixture import write_synthetic_bulk_cache

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "binance"
_KLINES_START_MS = 1_638_316_800_000   # 2021-12-01 = BACKTEST_HISTORY_START_DAY


@pytest.fixture(autouse=True)
def _pin_producer_clock(monkeypatch):
    """Fixture klines end 2026-05-04; the staleness guard compares against generated_at."""
    monkeypatch.setattr("producer.run_producer._now_iso", lambda: "2026-05-04T00:00:00Z")


@pytest.fixture
def canned_fetcher() -> BinanceFetcher:
    canned = {
        "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1500": (
            FIXTURE_DIR / "btcusdt_klines_1d_1500.json"
        ).read_bytes(),
        "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=1500": (
            FIXTURE_DIR / "ethusdt_klines_1d_1500.json"
        ).read_bytes(),
        # fetch_klines_range's default page_limit is now BINANCE_KLINES_MAX_LIMIT
        # (1000) -- Binance silently caps the real API at 1000 rows regardless of
        # what a caller asks for (see fetch_binance.py). The plain (no startTime)
        # entries above are for fetch_klines, which compose_assets still calls
        # with limit=1500 -- unaffected by that change.
        f"https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime={_KLINES_START_MS}&limit=1000": (
            FIXTURE_DIR / "btcusdt_klines_1d_1500.json"
        ).read_bytes(),
        f"https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&startTime={_KLINES_START_MS}&limit=1000": (
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
    return BinanceFetcher(http_get=lambda url: canned[url])


@pytest.fixture
def bulk_cache(tmp_path: Path) -> Path:
    """Synthetic bulk OI/funding cache covering every candle day in the klines
    fixtures, so producer.bulk_history.refresh() finds the walked backtest
    window's coverage complete without any network access (offline tests)."""
    cache_dir = tmp_path / "bulk"
    write_synthetic_bulk_cache(cache_dir, "BTCUSDT", FIXTURE_DIR / "btcusdt_klines_1d_1500.json")
    write_synthetic_bulk_cache(cache_dir, "ETHUSDT", FIXTURE_DIR / "ethusdt_klines_1d_1500.json")
    return cache_dir


@pytest.fixture
def valid_existing_sidecar() -> dict:
    # This day is outside the canned OI window but inside its funding window.
    row = {
        "bucket_start": "2026-03-01T00:00:00Z",
        "bucket_end": "2026-03-02T00:00:00Z",
        "open_interest": {
            "sample_count": 6,
            "first": 100.0,
            "last": 100.0,
            "min": 100.0,
            "max": 100.0,
            "avg": 100.0,
            "last_usd": 1000.0,
            "avg_usd": 1000.0,
            "growth_pct": 0.0,
        },
        "funding": {
            "sample_count": 3,
            "sum": 0.0003,
            "avg": 0.0001,
            "abs_avg": 0.0001,
            "max_abs": 0.0001,
            "last": 0.0001,
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
    return {
        "schema_version": "pivots_derivatives_history.v0.1",
        "generated_at": "2026-03-02T00:00:00Z",
        "provider": "binance_usdm",
        "assets": {
            asset: {"symbol": f"{asset}USDT", "history": [deepcopy(row)]}
            for asset in ("BTC", "ETH")
        },
    }


@pytest.fixture(
    params=[
        "bad-json",
        "invalid-utf8",
        "unreadable",
        "wrong-schema",
        "non-object",
        "missing-eth",
        "string-count",
        "missing-funding",
        "excessive-oi-count",
        "excessive-funding-count",
    ]
)
def invalid_saved_sidecar(
    request, tmp_path: Path, valid_existing_sidecar: dict
) -> tuple[Path, bytes, bool]:
    case = request.param
    snapshot = valid_existing_sidecar
    row = snapshot["assets"]["BTC"]["history"][0]
    if case == "wrong-schema":
        snapshot["schema_version"] = "unsupported"
    elif case == "non-object":
        snapshot = []
    elif case == "missing-eth":
        del snapshot["assets"]["ETH"]
    elif case == "string-count":
        row["open_interest"]["sample_count"] = "6"
    elif case == "missing-funding":
        del row["funding"]
    elif case == "excessive-oi-count":
        row["open_interest"]["sample_count"] = 7
    elif case == "excessive-funding-count":
        row["funding"]["sample_count"] = 4

    old_bytes = (json.dumps(snapshot, indent=4) + "\n").encode("utf-8")
    if case == "bad-json":
        old_bytes = b'{\n  "schema_version": '
    elif case == "invalid-utf8":
        old_bytes = b"\xff\xfeinvalid-sidecar\n"
    target = tmp_path / "pivot_derivatives_history.live.json"
    target.write_bytes(old_bytes)
    return target, old_bytes, case == "unreadable"


@pytest.mark.parametrize("dry_run", [False, True], ids=["promote", "dry-run"])
def test_invalid_saved_sidecar_degrades_without_replacing_history(
    tmp_path: Path,
    canned_fetcher: BinanceFetcher,
    invalid_saved_sidecar,
    dry_run: bool,
    capsys,
    monkeypatch,
    bulk_cache: Path,
) -> None:
    sidecar_target, old_sidecar, unreadable = invalid_saved_sidecar
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    old_assets = b'{"sentinel": "old_assets"}\n'
    old_backtest = b'{"sentinel": "old_backtest"}\n'
    assets_target.write_bytes(old_assets)
    backtest_target.write_bytes(old_backtest)

    with (
        monkeypatch.context() as read_patch,
        patch(
            "producer.run_producer.atomic_write_json",
            wraps=run_producer_module.atomic_write_json,
        ) as write_json,
    ):
        if unreadable:
            real_open = Path.open

            def unreadable_sidecar(path, *args, **kwargs):
                if path == sidecar_target:
                    raise PermissionError(
                        "sidecar read denied\nsecond line\rthird line"
                    )
                return real_open(path, *args, **kwargs)

            read_patch.setattr(Path, "open", unreadable_sidecar)
        rc = run_producer(
            fetcher=canned_fetcher,
            bulk_cache_dir=bulk_cache,
            bulk_http_get=lambda url: (404, b""),
            assets_path=assets_target,
            backtest_path=backtest_target,
            derivatives_history_path=sidecar_target,
            dry_run=dry_run,
            skip_zod_validate=True,
        )
        with pytest.raises(ValueError) as error:
            load_derivatives_history_sidecar(sidecar_target)

    assert rc == 0
    if dry_run:
        assert assets_target.read_bytes() == old_assets
        assert backtest_target.read_bytes() == old_backtest
    else:
        assets = json.loads(assets_target.read_text())
        backtest = json.loads(backtest_target.read_text())
        assert assets["schema_version"] == backtest["schema_version"] == "v0.1"
        assert {entry["symbol"] for entry in assets["radar"]} == {"BTC", "ETH"}
        assert len(backtest["entries"]) == 36
        assert assets["generated_at"] == backtest["generated_at"]
    assert sidecar_target.read_bytes() == old_sidecar
    for target in (assets_target, backtest_target, sidecar_target):
        for suffix in (".tmp", ".tmp.tmp", ".bak"):
            assert not target.with_name(target.name + suffix).exists()

    captured = capsys.readouterr()
    assert captured.err == ""
    degraded = [
        line for line in captured.out.splitlines() if "sidecar_degraded=" in line
    ]
    prefix = "[pivots-producer] sidecar_degraded=SidecarValidationError: "
    assert len(degraded) == 1
    assert degraded[0].startswith(prefix)
    assert type(error.value).__name__ == "SidecarValidationError"
    reason = str(error.value)
    assert reason.strip()
    assert len(reason.splitlines()) == 1
    assert degraded[0] == prefix + reason
    assert [call.args[0] for call in write_json.call_args_list] == [
        assets_target.with_suffix(".json.tmp"),
        backtest_target.with_suffix(".json.tmp"),
    ]


def test_dry_run_does_not_touch_target(
    tmp_path: Path, canned_fetcher: BinanceFetcher,
    bulk_cache: Path,
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assets_target.write_text('{"sentinel": "old"}')
    backtest_target.write_text('{"sentinel": "old"}')
    rc = run_producer(
        fetcher=canned_fetcher,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
        assets_path=assets_target,
        backtest_path=backtest_target,
        dry_run=True,
        skip_zod_validate=True,  # validator covered separately
    )
    assert rc == 0
    # Targets unchanged.
    assert json.loads(assets_target.read_text()) == {"sentinel": "old"}
    assert json.loads(backtest_target.read_text()) == {"sentinel": "old"}
    # No tmp / bak leftovers.
    for leftover in (
        tmp_path / "pivot_assets.live.json.tmp",
        tmp_path / "pivot_backtest.live.json.tmp",
        tmp_path / "pivot_assets.live.json.bak",
        tmp_path / "pivot_backtest.live.json.bak",
    ):
        assert not leftover.exists()


def test_dry_run_still_runs_zod_validator(
    tmp_path: Path, canned_fetcher: BinanceFetcher,
    bulk_cache: Path,
) -> None:
    """Codex review 1, should-fix: dry-run must still validate the produced
    payload so schema bugs surface during local development before they
    reach a live run."""
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assets_target.write_text('{"sentinel": "old"}')
    backtest_target.write_text('{"sentinel": "old"}')
    with patch(
        "producer.run_producer._run_vitest_validator", return_value=True
    ) as validator:
        rc = run_producer(
            fetcher=canned_fetcher,
            bulk_cache_dir=bulk_cache,
            bulk_http_get=lambda url: (404, b""),
            assets_path=assets_target,
            backtest_path=backtest_target,
            dry_run=True,
            skip_zod_validate=False,  # explicit
        )
    assert rc == 0
    assert validator.called, "validator must run even in dry-run mode"


def test_run_producer_passes_backtest_quality_to_assets(tmp_path: Path, bulk_cache: Path) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    entries = [{"symbol": "BTC", "timeframe": "1d", "score": 1}]
    quality = {("BTC", "7D"): 42.0}

    with (
        patch(
            "producer.run_producer.compose_pivot_backtest_snapshot",
            return_value={"entries": entries},
        ) as compose_backtest,
        patch(
            "producer.run_producer.build_backtest_quality_map",
            return_value=quality,
        ) as build_quality,
        patch(
            "producer.run_producer.compose_pivot_assets_snapshot",
            return_value={"radar": []},
        ) as compose_assets,
    ):
        rc = run_producer(
            fetcher=BinanceFetcher(http_get=lambda _url: b"[]"),
            bulk_cache_dir=bulk_cache,
            bulk_http_get=lambda url: (404, b""),
            assets_path=assets_target,
            backtest_path=backtest_target,
            dry_run=True,
            skip_zod_validate=True,
        )

    assert rc == 0
    compose_backtest.assert_called_once()
    build_quality.assert_called_once_with(entries)
    compose_assets.assert_called_once()
    assert compose_assets.call_args.kwargs["backtest_quality_by_key"] == quality
    assert not assets_target.exists()
    assert not backtest_target.exists()


def test_live_write_replaces_target_atomically(
    tmp_path: Path, canned_fetcher: BinanceFetcher,
    bulk_cache: Path,
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assets_target.write_text('{"sentinel": "old"}')
    rc = run_producer(
        fetcher=canned_fetcher,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
        assets_path=assets_target,
        backtest_path=backtest_target,
        dry_run=False,
        skip_zod_validate=True,
    )
    assert rc == 0
    assets = json.loads(assets_target.read_text())
    assert assets["schema_version"] == "v0.1"
    assert {a["symbol"] for a in assets["radar"]} == {"BTC", "ETH"}
    bt = json.loads(backtest_target.read_text())
    assert len(bt["entries"]) == 36
    # Bak files cleaned on success.
    assert not (tmp_path / "pivot_assets.live.json.bak").exists()
    assert not (tmp_path / "pivot_backtest.live.json.bak").exists()


def test_custom_targets_do_not_touch_canonical_sidecar(
    tmp_path: Path, canned_fetcher: BinanceFetcher, monkeypatch,
    bulk_cache: Path,
) -> None:
    parameter = inspect.signature(run_producer).parameters[
        "derivatives_history_path"
    ]
    assert parameter.default is None

    canonical = tmp_path / "canonical" / "pivot_derivatives_history.live.json"
    canonical.parent.mkdir()
    canonical.write_bytes(b"canonical-sentinel")
    monkeypatch.setattr(
        run_producer_module,
        "DEFAULT_DERIVATIVES_HISTORY",
        canonical,
    )
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()
    assets_target = custom_dir / "pivot_assets.live.json"
    backtest_target = custom_dir / "pivot_backtest.live.json"

    rc = run_producer(
        fetcher=canned_fetcher,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
        assets_path=assets_target,
        backtest_path=backtest_target,
        dry_run=False,
        skip_zod_validate=True,
    )

    assert rc == 0
    assert canonical.read_bytes() == b"canonical-sentinel"
    assert (custom_dir / "pivot_derivatives_history.live.json").exists()


def test_fetcher_failure_leaves_existing_snapshot_intact(tmp_path: Path, bulk_cache: Path) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assets_target.write_text('{"sentinel": "good_old"}')
    backtest_target.write_text('{"sentinel": "good_old"}')

    def _broken(_url: str) -> bytes:
        raise OSError("network down")

    rc = run_producer(
        fetcher=BinanceFetcher(http_get=_broken),
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
        assets_path=assets_target,
        backtest_path=backtest_target,
        dry_run=False,
        skip_zod_validate=True,
    )
    assert rc != 0
    # Existing files untouched.
    assert json.loads(assets_target.read_text()) == {"sentinel": "good_old"}
    assert json.loads(backtest_target.read_text()) == {"sentinel": "good_old"}
    # No tmp / bak leftovers.
    for leftover in (
        tmp_path / "pivot_assets.live.json.tmp",
        tmp_path / "pivot_backtest.live.json.tmp",
        tmp_path / "pivot_assets.live.json.bak",
        tmp_path / "pivot_backtest.live.json.bak",
    ):
        assert not leftover.exists()


def test_partial_promotion_failure_rolls_back_assets(
    tmp_path: Path, canned_fetcher: BinanceFetcher,
    bulk_cache: Path,
) -> None:
    """Codex review 1, must-fix #2: if assets replace succeeds but backtest
    replace fails, the prior assets snapshot must be restored from .bak so
    the consumer never sees an inconsistent pair."""
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assets_target.write_text('{"sentinel": "good_old_assets"}')
    backtest_target.write_text('{"sentinel": "good_old_backtest"}')

    real_replace = os.replace
    call_count = {"n": 0}

    def _flaky_replace(src, dst):
        # shutil.copy2 used by the .bak step does not call os.replace, so the
        # only os.replace calls in the happy path are:
        #   call 1: assets_tmp → assets_target  (succeeds)
        #   call 2: backtest_tmp → backtest_target  (must fail)
        #   call 3: assets_bak → assets_target  (rollback — must succeed)
        call_count["n"] += 1
        if call_count["n"] == 2:
            raise OSError("simulated rename failure on backtest target")
        return real_replace(src, dst)

    with patch("producer.run_producer.os.replace", side_effect=_flaky_replace):
        rc = run_producer(
            fetcher=canned_fetcher,
            bulk_cache_dir=bulk_cache,
            bulk_http_get=lambda url: (404, b""),
            assets_path=assets_target,
            backtest_path=backtest_target,
            dry_run=False,
            skip_zod_validate=True,
        )
    assert rc != 0
    # Both targets restored to their pre-run contents.
    assert json.loads(assets_target.read_text()) == {"sentinel": "good_old_assets"}
    assert json.loads(backtest_target.read_text()) == {"sentinel": "good_old_backtest"}
    # No leftovers.
    for leftover in (
        tmp_path / "pivot_assets.live.json.tmp",
        tmp_path / "pivot_backtest.live.json.tmp",
        tmp_path / "pivot_assets.live.json.bak",
        tmp_path / "pivot_backtest.live.json.bak",
    ):
        assert not leftover.exists()


def test_orphan_bak_warning_on_startup(
    tmp_path: Path, canned_fetcher: BinanceFetcher, capsys,
    bulk_cache: Path,
) -> None:
    """If a previous run crashed mid-promotion the .bak files persist. The
    producer's startup path warns about them and refuses to run; the
    operator is responsible for inspecting .bak vs target and deleting one.
    There is no automatic recovery (Codex review 2, fix #2)."""
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assets_target.write_text('{"sentinel": "current"}')
    backtest_target.write_text('{"sentinel": "current"}')
    (tmp_path / "pivot_assets.live.json.bak").write_text('{"sentinel": "stale"}')

    rc = run_producer(
        fetcher=canned_fetcher,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
        assets_path=assets_target,
        backtest_path=backtest_target,
        dry_run=False,
        skip_zod_validate=True,
    )
    assert rc != 0
    captured = capsys.readouterr()
    assert "orphan" in captured.err.lower() or "bak" in captured.err.lower()
    # Producer must not have touched the existing target or the orphan .bak.
    assert json.loads(assets_target.read_text()) == {"sentinel": "current"}
    assert (tmp_path / "pivot_assets.live.json.bak").exists()


def test_partial_promotion_failure_with_absent_targets_unlinks_promoted(
    tmp_path: Path, canned_fetcher: BinanceFetcher,
    bulk_cache: Path,
) -> None:
    """Codex review 2, fix #3: when the targets did not exist before this run
    (fresh install) and the backtest promotion fails after the assets
    promotion succeeded, rollback must unlink the just-promoted assets
    target so the filesystem returns to its pre-run absent state."""
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assert not assets_target.exists()
    assert not backtest_target.exists()

    real_replace = os.replace
    call_count = {"n": 0}

    def _flaky_replace(src, dst):
        # No backups created (fresh install), so the only os.replace calls are:
        #   call 1: assets_tmp → assets_target  (succeeds)
        #   call 2: backtest_tmp → backtest_target  (must fail)
        call_count["n"] += 1
        if call_count["n"] == 2:
            raise OSError("simulated rename failure on backtest target")
        return real_replace(src, dst)

    with patch("producer.run_producer.os.replace", side_effect=_flaky_replace):
        rc = run_producer(
            fetcher=canned_fetcher,
            bulk_cache_dir=bulk_cache,
            bulk_http_get=lambda url: (404, b""),
            assets_path=assets_target,
            backtest_path=backtest_target,
            dry_run=False,
            skip_zod_validate=True,
        )
    assert rc != 0
    # Both targets back to absent — no half-promoted state visible to consumer.
    assert not assets_target.exists()
    assert not backtest_target.exists()
    for leftover in (
        tmp_path / "pivot_assets.live.json.tmp",
        tmp_path / "pivot_backtest.live.json.tmp",
        tmp_path / "pivot_assets.live.json.bak",
        tmp_path / "pivot_backtest.live.json.bak",
    ):
        assert not leftover.exists()


def test_dry_run_writes_and_removes_sidecar_tmp(
    tmp_path: Path, canned_fetcher: BinanceFetcher,
    bulk_cache: Path,
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    assets_target.write_text('{"sentinel": "old"}')
    backtest_target.write_text('{"sentinel": "old"}')
    rc = run_producer(
        fetcher=canned_fetcher,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
        assets_path=assets_target,
        backtest_path=backtest_target,
        derivatives_history_path=sidecar_target,
        dry_run=True,
        skip_zod_validate=True,
    )
    assert rc == 0
    assert not sidecar_target.exists()
    assert not (tmp_path / "pivot_derivatives_history.live.json.tmp").exists()
    assert not (tmp_path / "pivot_derivatives_history.live.json.bak").exists()


def test_live_write_promotes_sidecar_after_public_pair(
    tmp_path: Path, canned_fetcher: BinanceFetcher, capsys,
    bulk_cache: Path,
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    assert load_derivatives_history_sidecar(sidecar_target) is None
    rc = run_producer(
        fetcher=canned_fetcher,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
        assets_path=assets_target,
        backtest_path=backtest_target,
        derivatives_history_path=sidecar_target,
        dry_run=False,
        skip_zod_validate=True,
    )
    assert rc == 0
    sidecar = json.loads(sidecar_target.read_text())
    assert sidecar["schema_version"] == "pivots_derivatives_history.v0.1"
    assert set(sidecar["assets"]) == {"BTC", "ETH"}
    assert load_derivatives_history_sidecar(sidecar_target) == sidecar
    assert all(block["history"] for block in sidecar["assets"].values())
    assert "sidecar_degraded=" not in capsys.readouterr().out
    assert not sidecar_target.with_suffix(".json.tmp").exists()
    assert not sidecar_target.with_suffix(".json.bak").exists()


@pytest.mark.parametrize("dry_run", [False, True], ids=["promote", "dry-run"])
def test_valid_sidecar_preserves_oi_outside_fetch_window(
    tmp_path: Path,
    canned_fetcher: BinanceFetcher,
    valid_existing_sidecar: dict,
    dry_run: bool,
    capsys,
    bulk_cache: Path,
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    old_sidecar = (json.dumps(valid_existing_sidecar, indent=4) + "\n").encode()
    sidecar_target.write_bytes(old_sidecar)
    old_public = b'{"sentinel": "old_public"}\n'
    assets_target.write_bytes(old_public)
    backtest_target.write_bytes(old_public)
    assert load_derivatives_history_sidecar(sidecar_target) == valid_existing_sidecar

    rc = run_producer(
        fetcher=canned_fetcher,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
        assets_path=assets_target,
        backtest_path=backtest_target,
        derivatives_history_path=sidecar_target,
        dry_run=dry_run,
        skip_zod_validate=True,
    )

    assert rc == 0
    assert "sidecar_degraded=" not in capsys.readouterr().out
    if dry_run:
        assert sidecar_target.read_bytes() == old_sidecar
        assert assets_target.read_bytes() == backtest_target.read_bytes() == old_public
    else:
        sidecar = load_derivatives_history_sidecar(sidecar_target)
        assert sidecar is not None
        for asset in ("BTC", "ETH"):
            rows = sidecar["assets"][asset]["history"]
            assert len(rows) > 1
            retained = next(
                row for row in rows
                if row["bucket_start"] == "2026-03-01T00:00:00Z"
            )
            previous = valid_existing_sidecar["assets"][asset]["history"][0]
            assert retained["open_interest"] == previous["open_interest"]
            assert retained["funding"] != previous["funding"]
            assert retained["completeness"]["open_interest"] == 1.0
        assert json.loads(assets_target.read_text())["schema_version"] == "v0.1"
        assert json.loads(backtest_target.read_text())["schema_version"] == "v0.1"
    for target in (assets_target, backtest_target, sidecar_target):
        for suffix in (".tmp", ".bak"):
            assert not target.with_name(target.name + suffix).exists()


def test_sidecar_compose_failure_keeps_public_success_and_preserves_old_sidecar(
    tmp_path: Path,
    canned_fetcher: BinanceFetcher,
    valid_existing_sidecar: dict,
    capsys,
    bulk_cache: Path,
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    old_sidecar = (json.dumps(valid_existing_sidecar, indent=4) + "\n").encode()
    sidecar_target.write_bytes(old_sidecar)
    assert load_derivatives_history_sidecar(sidecar_target) == valid_existing_sidecar
    with patch(
        "producer.run_producer.compose_derivatives_history_sidecar",
        side_effect=RuntimeError("sidecar provider down"),
    ) as compose_sidecar:
        rc = run_producer(
            fetcher=canned_fetcher,
            bulk_cache_dir=bulk_cache,
            bulk_http_get=lambda url: (404, b""),
            assets_path=assets_target,
            backtest_path=backtest_target,
            derivatives_history_path=sidecar_target,
            dry_run=False,
            skip_zod_validate=True,
        )
    assert rc == 0
    assert json.loads(assets_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(backtest_target.read_text())["schema_version"] == "v0.1"
    compose_sidecar.assert_called_once()
    assert compose_sidecar.call_args.kwargs["existing"] == valid_existing_sidecar
    assert sidecar_target.read_bytes() == old_sidecar
    assert not sidecar_target.with_suffix(".json.tmp").exists()
    assert not sidecar_target.with_suffix(".json.bak").exists()
    captured = capsys.readouterr()
    assert "sidecar_degraded=RuntimeError: sidecar provider down" in captured.out


@pytest.mark.parametrize(
    "rollback_fails", [False, True], ids=["rollback-succeeds", "rollback-fails"]
)
def test_sidecar_promotion_failure_does_not_rollback_public_pair(
    tmp_path: Path,
    canned_fetcher: BinanceFetcher,
    valid_existing_sidecar: dict,
    rollback_fails: bool,
    capsys,
    bulk_cache: Path,
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    old_sidecar = (json.dumps(valid_existing_sidecar, indent=4) + "\n").encode()
    sidecar_target.write_bytes(old_sidecar)
    assert load_derivatives_history_sidecar(sidecar_target) == valid_existing_sidecar
    real_replace = os.replace
    sidecar_replaces = []

    def _flaky_replace(src, dst):
        if Path(dst) == sidecar_target:
            sidecar_replaces.append(Path(src))
            if Path(src) == sidecar_target.with_suffix(".json.tmp") or rollback_fails:
                raise OSError("sidecar rename failed")
        return real_replace(src, dst)

    with patch("producer.run_producer.os.replace", side_effect=_flaky_replace):
        rc = run_producer(
            fetcher=canned_fetcher,
            bulk_cache_dir=bulk_cache,
            bulk_http_get=lambda url: (404, b""),
            assets_path=assets_target,
            backtest_path=backtest_target,
            derivatives_history_path=sidecar_target,
            dry_run=False,
            skip_zod_validate=True,
        )
    assert rc == 0
    assert json.loads(assets_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(backtest_target.read_text())["schema_version"] == "v0.1"
    assert sidecar_replaces == [
        sidecar_target.with_suffix(".json.tmp"),
        sidecar_target.with_suffix(".json.bak"),
    ]
    assert sidecar_target.read_bytes() == old_sidecar
    if rollback_fails:
        assert sidecar_target.with_suffix(".json.bak").read_bytes() == old_sidecar
    else:
        assert not sidecar_target.with_suffix(".json.bak").exists()
    assert not sidecar_target.with_suffix(".json.tmp").exists()
    assert "sidecar_degraded=OSError: sidecar rename failed" in capsys.readouterr().out


def test_sidecar_orphan_bak_does_not_block_public_pair(
    tmp_path: Path, canned_fetcher: BinanceFetcher, capsys,
    bulk_cache: Path,
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    sidecar_target = tmp_path / "pivot_derivatives_history.live.json"
    sidecar_target.write_text('{"sentinel": "current_sidecar"}')
    (tmp_path / "pivot_derivatives_history.live.json.bak").write_text(
        '{"sentinel": "sidecar_bak"}'
    )

    rc = run_producer(
        fetcher=canned_fetcher,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
        assets_path=assets_target,
        backtest_path=backtest_target,
        derivatives_history_path=sidecar_target,
        dry_run=False,
        skip_zod_validate=True,
    )

    assert rc == 0
    assert json.loads(assets_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(backtest_target.read_text())["schema_version"] == "v0.1"
    assert json.loads(sidecar_target.read_text()) == {"sentinel": "current_sidecar"}
    assert (tmp_path / "pivot_derivatives_history.live.json.bak").exists()
    assert "sidecar_degraded=SidecarOrphanBak:" in capsys.readouterr().out


def test_run_producer_fails_closed_without_bulk_cache(
    tmp_path: Path, canned_fetcher: BinanceFetcher
) -> None:
    rc = run_producer(
        fetcher=canned_fetcher,
        assets_path=tmp_path / "a.json",
        backtest_path=tmp_path / "b.json",
        derivatives_history_path=tmp_path / "s.json",
        dry_run=True,
        skip_zod_validate=True,
        bulk_cache_dir=tmp_path / "empty",
        bulk_http_get=lambda url: (404, b""),
    )
    assert rc == 1
    assert not (tmp_path / "b.json").exists()


def test_run_producer_emits_bulk_degraded_marker_when_refresh_errors(
    tmp_path: Path, canned_fetcher: BinanceFetcher, bulk_cache: Path, capsys
) -> None:
    rc = run_producer(
        fetcher=canned_fetcher,
        assets_path=tmp_path / "a.json",
        backtest_path=tmp_path / "b.json",
        derivatives_history_path=tmp_path / "s.json",
        dry_run=True,
        skip_zod_validate=True,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (503, b""),
    )
    assert rc == 0                                  # cache is complete enough; refresh failure only degrades
    assert "bulk_history_degraded=" in capsys.readouterr().out


def test_run_producer_emits_lag_marker_when_bulk_days_are_missing(
    tmp_path: Path, canned_fetcher: BinanceFetcher, bulk_cache: Path, capsys, monkeypatch
) -> None:
    from producer.bulk_history import RefreshResult
    monkeypatch.setattr(
        "producer.run_producer.refresh",
        lambda *args, **kwargs: RefreshResult(
            fetched_days=0,
            missing_days={"BTCUSDT": ["2026-09-24", "2026-09-25", "2026-09-26"]},
            errors=[],
        ),
    )
    rc = run_producer(
        fetcher=canned_fetcher,
        assets_path=tmp_path / "a.json",
        backtest_path=tmp_path / "b.json",
        derivatives_history_path=tmp_path / "s.json",
        dry_run=True,
        skip_zod_validate=True,
        bulk_cache_dir=bulk_cache,
        bulk_http_get=lambda url: (404, b""),
    )
    assert rc == 0
    assert "bulk_history_degraded=bulk_history_lag_days=3" in capsys.readouterr().out
