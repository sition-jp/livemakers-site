"""Compose PivotBacktestSnapshot — 36 entries (2×3×3×2).

Real-history design (spec 2026-09-26 §5.4, Task 21 — no proxy, fail closed):
- Per-asset indicator series (rsi/macd_hist/dist_ma20/dist_ma50/rv_30d/
  bb_width/atr_14) are precomputed once per asset from Binance daily klines
  fetched from `BACKTEST_HISTORY_START_DAY` (2021-12-01) forward via
  `BinanceFetcher.fetch_klines_range`, then the (horizon × score_type ×
  threshold) walk reuses them. Volume ratio, range compression, and
  near-range-boundary are computed from full-history closes/volumes at
  each t.
- OI growth and funding evidence come from real bulk derivatives history
  (`producer.bulk_history.BulkHistory`, backfilled and cached externally),
  using windows identical to the live producer (compose_assets.py): 84
  four-hour OI buckets compared 14d-vs-prior-14d, and the last 180 funding
  events. There is no proxy and no synthesis: a candle day without full
  derivatives history simply contributes "no evidence available" (growth
  0.0, funding 0.0, a flat [0.0, 0.0] funding history) rather than a
  manufactured signal. Range compression uses the same < 0.05 threshold as
  the live producer.
- The walk itself starts at `walk_start = max(60, len(klines) -
  BACKTEST_LOOKBACK_DAYS)`. Before walking, `compose_pivot_backtest_snapshot`
  requires the caller to pass `history: dict[AssetSymbol, BulkHistory]`
  covering at least `MIN_HISTORY_COVERAGE` (90%) of the days between
  `walk_start` and the last candle, for every asset. If `history` is
  missing/empty or coverage is thin, it raises `BacktestHistoryError` and
  produces no snapshot at all — fail closed, never a degraded or proxy
  fallback.
- The returned snapshot carries a `data_provenance` block (`source` /
  `start` / `end` / `coverage_pct`) recording which real-history window
  backed the metrics.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from producer.backtest import (
    DIRECTION_LEAN_GAP,
    HIT_DEFINITIONS,
    BacktestHitContext,
    Signal,
    compute_metrics,
    detect_hit,
    first_hit_day,
    forward_move,
)
from producer.bulk_history import BulkHistory
from producer.fetch_binance import BinanceFetcher
from producer.indicators import (
    atr,
    bollinger_band_width,
    distance_from_ma,
    macd,
    realized_volatility,
    rsi,
)
from producer.percentiles import LOOKBACK_DAYS
from producer.score_direction_bias import score_direction_bias
from producer.score_price_pivot import score_price_pivot
from producer.score_volatility_pivot import score_volatility_pivot
from producer.types import (
    ASSETS,
    HORIZONS,
    SCORE_TYPES,
    THRESHOLDS,
    AssetSymbol,
    BacktestEntry,
    Horizon,
    PivotBacktestSnapshot,
    ScoreType,
)

# Backtest window: last 5 years of daily candles (or as many as the history
# provides — whichever is shorter).
BACKTEST_LOOKBACK_DAYS = 365 * 5

# Real-history backtest window starts here (bulk derivatives history is
# available from this day forward — see producer/bulk_history.py).
BACKTEST_HISTORY_START_DAY = "2021-12-01"

# Fail-closed threshold: below this fraction of days with full OI coverage
# over the walked window, compose_pivot_backtest_snapshot refuses to run.
MIN_HISTORY_COVERAGE = 0.90

# Fail-closed threshold: if the fetched klines end more than this many days
# before generated_at, the price series is stale/truncated (e.g. Binance's
# undocumented 1000-row klines cap silently cutting off a paged fetch) and
# the backtest must not run on it.
KLINES_MAX_STALENESS_DAYS = 3

_HISTORY_SOURCE = "binance_public_bulk_metrics+fapi_funding"


class BacktestHistoryError(RuntimeError):
    """Raised when real derivatives history is missing or too thin. Fail closed: no proxy fallback."""


@dataclass
class _AssetSeries:
    """Per-asset precomputed indicator series, indexed by candle position t.

    None at positions before the indicator's warmup window. Reading at any
    valid t is O(1); slicing a recent window for percentile baselines is
    O(W).
    """
    rsi: list[Optional[float]]
    macd_hist_recent: list[Optional[list[float]]]
    dist20: list[Optional[float]]
    dist50: list[Optional[float]]
    rv30: list[Optional[float]]
    bb: list[Optional[float]]
    atr14: list[Optional[float]]


@dataclass(frozen=True)
class _DerivAtT:
    oi_growth_pct: float
    abs_funding: float
    abs_funding_history: list[float]
    # Signed last funding event of the day (0.0 when unavailable) — feeds the
    # direction-bias recompute (spec §5.4.7), which needs the sign, not just
    # the magnitude abs_funding carries.
    funding_signed: float = 0.0


def _deriv_series(klines_open_times: list[int], hist: BulkHistory) -> list[_DerivAtT]:
    """Per-candle derivatives inputs, identical windows to compose_assets (84 OI buckets / 180 funding events).

    Days without history contribute 'no derivatives evidence' (growth 0,
    funding 0 with a flat history) — never a proxy.
    """
    out = []
    for ms in klines_open_times:
        day = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).strftime("%Y-%m-%d")
        growth = hist.oi_growth_pct(day)
        funding = hist.abs_funding(day)
        funding_history = hist.abs_funding_history(day)
        funding_signed = hist.funding_last(day)
        out.append(_DerivAtT(
            oi_growth_pct=growth if growth is not None else 0.0,
            abs_funding=funding if funding is not None else 0.0,
            abs_funding_history=funding_history if funding_history else [0.0, 0.0],
            funding_signed=funding_signed if funding_signed is not None else 0.0,
        ))
    return out


def _precompute_asset_series(
    closes: list[float], highs: list[float], lows: list[float]
) -> _AssetSeries:
    n = len(closes)
    rsi_s: list[Optional[float]] = [None] * n
    macd_s: list[Optional[list[float]]] = [None] * n
    dist20_s: list[Optional[float]] = [None] * n
    dist50_s: list[Optional[float]] = [None] * n
    rv_s: list[Optional[float]] = [None] * n
    bb_s: list[Optional[float]] = [None] * n
    atr_s: list[Optional[float]] = [None] * n

    for t in range(n):
        sub_closes = closes[: t + 1]
        sub_highs = highs[: t + 1]
        sub_lows = lows[: t + 1]
        if len(sub_closes) >= 15:
            try:
                rsi_s[t] = rsi(sub_closes, 14)
            except ValueError:
                pass
        if len(sub_closes) >= 35:
            try:
                _, _, hist = macd(sub_closes)
                macd_s[t] = hist[-5:]
            except ValueError:
                pass
        if len(sub_closes) >= 20:
            try:
                dist20_s[t] = distance_from_ma(sub_closes, 20)
            except ValueError:
                pass
        if len(sub_closes) >= 50:
            try:
                dist50_s[t] = distance_from_ma(sub_closes, 50)
            except ValueError:
                pass
        if len(sub_closes) >= 31:
            try:
                rv_s[t] = realized_volatility(sub_closes, 30)
            except ValueError:
                pass
        if len(sub_closes) >= 20:
            try:
                bb_s[t] = bollinger_band_width(sub_closes, 20)
            except ValueError:
                pass
        if len(sub_closes) >= 15:
            try:
                atr_s[t] = atr(sub_highs, sub_lows, sub_closes, 14)
            except ValueError:
                pass

    return _AssetSeries(
        rsi=rsi_s,
        macd_hist_recent=macd_s,
        dist20=dist20_s,
        dist50=dist50_s,
        rv30=rv_s,
        bb=bb_s,
        atr14=atr_s,
    )


def _slice_history(
    series: list[Optional[float]], end: int, lookback: int
) -> list[float]:
    start = max(0, end - lookback)
    return [x for x in series[start:end] if x is not None]


def _hit_context(series: _AssetSeries, t: int) -> BacktestHitContext:
    return BacktestHitContext(
        atr_14=series.atr14[t],
        realized_vol_30d=series.rv30[t],
    )


def _historical_scores(
    closes: list[float],
    volumes: list[float],
    series: _AssetSeries,
    deriv: list[_DerivAtT],
    t: int,
    horizon: Horizon,
) -> tuple[int, int, int]:
    """Compute (price_pivot, volatility_pivot, overall) using only data
    available at time t (no look-ahead).

    Uses precomputed indicator series (rsi/macd/dist_ma20/dist_ma50/rv/bb/atr)
    at t, with percentile histories sized by the horizon's lookback window.
    Range compression, near-range-boundary, and volume_ratio_30d are
    computed from full-history closes/volumes at t. OI growth and funding
    come from real bulk derivatives history (deriv[t]) — the same windows
    the live producer uses (compose_assets.py), never a proxy.
    """
    rsi_t = series.rsi[t]
    macd_t = series.macd_hist_recent[t]
    if rsi_t is None or macd_t is None:
        return 0, 0, 0

    lookback = LOOKBACK_DAYS[horizon]
    dist20_history = _slice_history(series.dist20, t, lookback)
    dist50_history = _slice_history(series.dist50, t, lookback)
    rv_history = _slice_history(series.rv30, t, lookback)
    bb_history = _slice_history(series.bb, t, lookback)
    atr_history = _slice_history(series.atr14, t, lookback)

    # Need at least minimum history for percentile rules to be meaningful.
    if len(dist20_history) < 5 or len(rv_history) < 5:
        return 0, 0, 0

    dist20_t = series.dist20[t] or 0.0
    dist50_t = series.dist50[t] or 0.0
    rv_t = series.rv30[t] or 0.5
    bb_t = series.bb[t] or 0.05
    atr_t = series.atr14[t] or 100.0

    # Range boundary: within 2% of recent 30D high or low.
    if t >= 30:
        recent = closes[t - 29 : t + 1]
        near_boundary = closes[t] >= max(recent) * 0.98 or closes[t] <= min(recent) * 1.02
    else:
        near_boundary = False

    # 30D range compression: range / mean < 0.05 (matches live compose_assets.py).
    if t >= 30:
        recent = closes[t - 29 : t + 1]
        rng = max(recent) - min(recent)
        avg = sum(recent) / 30
        compression = (rng / avg) < 0.05 if avg > 0 else False
    else:
        compression = False

    # Volume ratio: today vs 30D average.
    if t >= 31:
        vol_avg = sum(volumes[t - 30 : t]) / 30
        vol_ratio = volumes[t] / vol_avg if vol_avg > 0 else 1.0
    else:
        vol_ratio = 1.0

    d = deriv[t]

    pp, _ = score_price_pivot({
        "rsi_14": rsi_t,
        "distance_from_ma_20": dist20_t,
        "distance_from_ma_50": dist50_t,
        "distance_from_ma_20_history": dist20_history,
        "distance_from_ma_50_history": dist50_history,
        "macd_hist_recent": macd_t,
        "near_range_boundary": near_boundary,
    })
    vp, _ = score_volatility_pivot({
        "rv_30d": rv_t,
        "rv_30d_history": rv_history,
        "bb_width": bb_t,
        "bb_width_history": bb_history,
        "atr_now": atr_t,
        "atr_history": atr_history if atr_history else [atr_t],
        "oi_growth_pct": d.oi_growth_pct,
        "price_range_compression": compression,
        "abs_funding": d.abs_funding,
        "abs_funding_history": d.abs_funding_history,
        "volume_ratio_30d": vol_ratio,
    })
    overall = int(round(pp * 0.45 + vp * 0.45 + 60 * 0.10))
    return pp, vp, overall


def _select_score(pp: int, vp: int, overall: int, score_type: ScoreType) -> int:
    if score_type == "price_pivot":
        return pp
    if score_type == "volatility_pivot":
        return vp
    return overall


def _historical_score(
    closes: list[float],
    volumes: list[float],
    series: _AssetSeries,
    deriv: list[_DerivAtT],
    t: int,
    score_type: ScoreType,
    horizon: Horizon,
) -> int:
    """Thin wrapper over _historical_scores, kept for callers/tests that only
    need a single score_type's score."""
    pp, vp, overall = _historical_scores(closes, volumes, series, deriv, t, horizon)
    return _select_score(pp, vp, overall, score_type)


def _historical_direction_lean(
    closes: list[float],
    series: _AssetSeries,
    deriv: list[_DerivAtT],
    t: int,
    vp: int,
) -> Optional[float]:
    """Recompute the direction bias lean (bullish - bearish) at t, using the
    SAME rule set the live producer uses (score_direction_bias). Spec
    2026-09-26 §5.4.7 — feeds the backtest's direction_samples /
    direction_hit_rate metrics. None before RSI/MACD warm up or before a 30D
    support/resistance window exists (t < 29)."""
    rsi_t = series.rsi[t]
    macd_t = series.macd_hist_recent[t]
    if rsi_t is None or macd_t is None or t < 29:
        return None

    recent = closes[t - 29 : t + 1]
    near_support = closes[t] <= min(recent) * 1.02
    near_resistance = closes[t] >= max(recent) * 0.98

    bias = score_direction_bias({
        "rsi_14": rsi_t,
        "near_support": near_support,
        "near_resistance": near_resistance,
        "funding": deriv[t].funding_signed,
        "macd_hist_recent": macd_t,
        "volatility_pivot_score": vp,
    })
    return round(bias["bullish"] - bias["bearish"], 1)


def _walk_backtest(
    asset_data,
    series: _AssetSeries,
    deriv: list[_DerivAtT],
    horizon: Horizon,
    score_type: ScoreType,
    threshold: int,
) -> tuple[list[Signal], int]:
    closes = asset_data["closes"]
    volumes = asset_data["volumes"]
    hd = HIT_DEFINITIONS[horizon]
    start_idx = max(60, len(closes) - BACKTEST_LOOKBACK_DAYS)
    signals: list[Signal] = []
    in_signal = False
    total_reversals = 0
    for t in range(start_idx, len(closes) - hd.horizon_days):
        ctx = _hit_context(series, t)
        pp, vp, overall = _historical_scores(closes, volumes, series, deriv, t, horizon)
        score = _select_score(pp, vp, overall, score_type)
        if score >= threshold and not in_signal:
            in_signal = True
            lead_time = first_hit_day(closes, t, hd, ctx)
            signals.append(Signal(
                index=t,
                score=score,
                hit=lead_time is not None,
                forward_move=forward_move(closes, t, hd),
                lead_time_days=lead_time,
                lean=_historical_direction_lean(closes, series, deriv, t, vp),
            ))
        elif score < threshold:
            in_signal = False
        # Count any window where a true reversal happened (for recall denom).
        if detect_hit(closes, t, hd, ctx):
            total_reversals += 1
    return signals, total_reversals


def _isoformat_from_ms(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).date().isoformat()


def compose_pivot_backtest_snapshot(
    fetcher: BinanceFetcher,
    generated_at: str,
    *,
    history: dict[AssetSymbol, BulkHistory],
) -> PivotBacktestSnapshot:
    if not history:
        raise BacktestHistoryError("bulk derivatives history is required (no proxy fallback)")

    generated_at_ms = int(
        datetime.strptime(generated_at, "%Y-%m-%dT%H:%M:%SZ")
        .replace(tzinfo=timezone.utc)
        .timestamp()
        * 1000
    )

    start_ms = int(
        datetime.strptime(BACKTEST_HISTORY_START_DAY, "%Y-%m-%d")
        .replace(tzinfo=timezone.utc)
        .timestamp()
        * 1000
    )

    asset_payloads = {}
    asset_series: dict[AssetSymbol, _AssetSeries] = {}
    coverage_by_asset: dict[AssetSymbol, float] = {}
    deriv_by_asset: dict[AssetSymbol, list[_DerivAtT]] = {}
    for a in ASSETS:
        klines = fetcher.fetch_klines_range(a, start_ms=start_ms)
        staleness_cutoff_ms = generated_at_ms - KLINES_MAX_STALENESS_DAYS * 86_400_000
        if klines[-1].close_time < staleness_cutoff_ms:
            last_date = _isoformat_from_ms(klines[-1].close_time)
            raise BacktestHistoryError(
                f"{a}: klines end {last_date} is more than {KLINES_MAX_STALENESS_DAYS} days before generated_at"
            )
        if a not in history:
            raise BacktestHistoryError(f"{a}: no bulk history supplied")
        hist = history[a]
        open_times = [c.open_time for c in klines]
        walk_start = max(60, len(klines) - BACKTEST_LOOKBACK_DAYS)
        first_day = _isoformat_from_ms(open_times[walk_start])
        last_day = _isoformat_from_ms(open_times[-1])
        cov = hist.coverage(first_day, last_day)
        if cov < MIN_HISTORY_COVERAGE:
            raise BacktestHistoryError(
                f"{a}: history coverage {cov:.3f} < {MIN_HISTORY_COVERAGE:.2f} over {first_day}..{last_day}"
            )
        coverage_by_asset[a] = cov
        deriv_by_asset[a] = _deriv_series(open_times, hist)

        payload = {
            "closes": [c.close for c in klines],
            "highs": [c.high for c in klines],
            "lows": [c.low for c in klines],
            "volumes": [c.volume for c in klines],
            "first_open_time": klines[0].open_time,
            "last_close_time": klines[-1].close_time,
        }
        asset_payloads[a] = payload
        # Precompute indicator series ONCE per asset; reused across all 18
        # (horizon, score_type, threshold) tuples for that asset.
        asset_series[a] = _precompute_asset_series(
            payload["closes"], payload["highs"], payload["lows"]
        )

    entries: list[BacktestEntry] = []
    for a in ASSETS:
        data = asset_payloads[a]
        series = asset_series[a]
        deriv = deriv_by_asset[a]
        for h in HORIZONS:
            for st in SCORE_TYPES:
                for thr in THRESHOLDS:
                    signals, total_reversals = _walk_backtest(
                        data, series, deriv, h, st, thr
                    )
                    metrics = compute_metrics(signals, total_reversals)
                    entries.append({
                        "asset": a,
                        "horizon": h,
                        "score_type": st,
                        "threshold": thr,
                        "period": {
                            "start": _isoformat_from_ms(data["first_open_time"]),
                            "end": _isoformat_from_ms(data["last_close_time"]),
                        },
                        "metrics": metrics,
                    })
    return {
        "schema_version": "v0.1",
        "generated_at": generated_at,
        "entries": entries,
        "data_provenance": {
            "source": _HISTORY_SOURCE,
            "start": min(h.first_day() for h in history.values() if h.first_day()),
            "end": max(h.last_day() for h in history.values() if h.last_day()),
            "coverage_pct": round(min(coverage_by_asset.values()) * 100.0, 1),
        },
    }
