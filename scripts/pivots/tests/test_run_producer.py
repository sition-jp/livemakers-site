import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest

from producer.fetch_binance import BinanceFetcher
from producer.run_producer import run_producer

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "binance"


@pytest.fixture
def canned_fetcher() -> BinanceFetcher:
    canned = {
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
    return BinanceFetcher(http_get=lambda url: canned[url])


def test_dry_run_does_not_touch_target(
    tmp_path: Path, canned_fetcher: BinanceFetcher
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assets_target.write_text('{"sentinel": "old"}')
    backtest_target.write_text('{"sentinel": "old"}')
    rc = run_producer(
        fetcher=canned_fetcher,
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
    tmp_path: Path, canned_fetcher: BinanceFetcher
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
            assets_path=assets_target,
            backtest_path=backtest_target,
            dry_run=True,
            skip_zod_validate=False,  # explicit
        )
    assert rc == 0
    assert validator.called, "validator must run even in dry-run mode"


def test_live_write_replaces_target_atomically(
    tmp_path: Path, canned_fetcher: BinanceFetcher
) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assets_target.write_text('{"sentinel": "old"}')
    rc = run_producer(
        fetcher=canned_fetcher,
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


def test_fetcher_failure_leaves_existing_snapshot_intact(tmp_path: Path) -> None:
    assets_target = tmp_path / "pivot_assets.live.json"
    backtest_target = tmp_path / "pivot_backtest.live.json"
    assets_target.write_text('{"sentinel": "good_old"}')
    backtest_target.write_text('{"sentinel": "good_old"}')

    def _broken(_url: str) -> bytes:
        raise OSError("network down")

    rc = run_producer(
        fetcher=BinanceFetcher(http_get=_broken),
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
    tmp_path: Path, canned_fetcher: BinanceFetcher
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
    tmp_path: Path, canned_fetcher: BinanceFetcher, capsys
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
    tmp_path: Path, canned_fetcher: BinanceFetcher
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
