"""Compose PivotAssetsSnapshot for v0.1.

Pipeline per (asset, horizon):
  1. Fetch klines / OI / funding (cached per asset across horizons).
  2. Build indicator series.
  3. Build percentile lookback windows sized by HORIZON.
  4. Run Price Pivot, Volatility Pivot, Direction Bias scorers.
  5. Run Confidence scorer using data completeness + signal agreement +
     a v0.1 documented backtest_quality default of 60.0 (real backtest
     quality wiring lands in v0.2 once the historical scoring path is
     upgraded).
  6. Assemble Evidence and PivotDetail.
  7. Emit RadarScores per (asset, horizon) and roll up to PivotAssetsSnapshot.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from producer.backtest_quality import DEFAULT_BACKTEST_QUALITY, BacktestQualityKey
from producer.evidence import collect_summary
from producer.fetch_binance import BinanceFetcher
from producer.indicators import (
    atr,
    bollinger_band_width,
    distance_from_ma,
    macd,
    moving_average,
    realized_volatility,
    rsi,
)
from producer.percentiles import LOOKBACK_DAYS
from producer.score_confidence import score_confidence
from producer.score_direction_bias import score_direction_bias
from producer.score_derivatives_evidence import (
    DerivativesEvidenceContext,
    score_derivatives_evidence,
)
from producer.score_price_pivot import MarketContext, score_price_pivot
from producer.score_volatility_pivot import (
    VolatilityContext,
    score_volatility_pivot,
)
from producer.types import (
    ASSETS,
    HORIZONS,
    AssetSymbol,
    Horizon,
    PivotAssetsSnapshot,
    PivotDetail,
    RadarAsset,
    detail_key,
    score_level,
)

ASSET_NAMES: dict[AssetSymbol, str] = {"BTC": "Bitcoin", "ETH": "Ethereum"}
_DERIVATIVES_PUBLIC_DUPLICATE_CATEGORIES = {"oi", "funding"}


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


def _ratio_values(points) -> list[float]:
    return [p.long_short_ratio for p in points if p.long_short_ratio > 0]


def _closed_ratio_history(values: list[float]) -> list[float]:
    # Binance period=1d ratio endpoints include the still-forming current UTC
    # day. Daily evidence should use only settled buckets.
    return values[:-1]


def _append_derivatives_evidence(base: list, extra: list) -> list:
    seen = {(item["category"], item["message"]) for item in base}
    out = list(base)
    for item in extra:
        if item["category"] in _DERIVATIVES_PUBLIC_DUPLICATE_CATEGORIES:
            continue
        key = (item["category"], item["message"])
        if key not in seen:
            out.append(item)
            seen.add(key)
    return out


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


def _build_market_context(data: _AssetData, horizon: Horizon) -> MarketContext:
    lb = LOOKBACK_DAYS[horizon]
    closes = data.closes
    if len(closes) < lb + 50:
        # Defensive: producer should always have ample history; truncate gracefully.
        lb = max(30, min(lb, len(closes) - 50))

    rsi_val = rsi(closes, 14)
    _, _, hist = macd(closes)
    dist20 = distance_from_ma(closes, 20)
    dist50 = distance_from_ma(closes, 50)

    # Build distance histories over the lookback window.
    dist20_history = [
        (closes[i] - sum(closes[i - 19 : i + 1]) / 20) / (sum(closes[i - 19 : i + 1]) / 20)
        for i in range(len(closes) - lb, len(closes))
        if i >= 19
    ]
    dist50_history = [
        (closes[i] - sum(closes[i - 49 : i + 1]) / 50) / (sum(closes[i - 49 : i + 1]) / 50)
        for i in range(len(closes) - lb, len(closes))
        if i >= 49
    ]

    # Range boundary check: within 2% of recent high or low.
    recent_high = max(closes[-30:])
    recent_low = min(closes[-30:])
    near_boundary = (
        closes[-1] >= recent_high * 0.98 or closes[-1] <= recent_low * 1.02
    )

    return {
        "rsi_14": rsi_val,
        "distance_from_ma_20": dist20,
        "distance_from_ma_50": dist50,
        "distance_from_ma_20_history": dist20_history,
        "distance_from_ma_50_history": dist50_history,
        "macd_hist_recent": hist[-5:],
        "near_range_boundary": near_boundary,
    }


def _build_volatility_context(
    data: _AssetData, horizon: Horizon
) -> VolatilityContext:
    lb = LOOKBACK_DAYS[horizon]
    closes = data.closes
    highs = data.highs
    lows = data.lows
    volumes = data.volumes

    rv_now = realized_volatility(closes, 30)
    rv_history = [
        realized_volatility(closes[: i + 1], 30)
        for i in range(len(closes) - lb, len(closes))
        if i > 30
    ]

    bb_now = bollinger_band_width(closes, 20)
    bb_history = [
        bollinger_band_width(closes[: i + 1], 20)
        for i in range(len(closes) - lb, len(closes))
        if i >= 20
    ]

    atr_now = atr(highs, lows, closes, 14)
    atr_history = [
        atr(highs[: i + 1], lows[: i + 1], closes[: i + 1], 14)
        for i in range(len(closes) - lb, len(closes))
        if i > 14
    ]

    # Open Interest growth: last 14d vs prior 14d, expressed at 4h granularity
    # (84 buckets per 14-day window). Binance caps OI history at 30 days, so
    # we compare two halves of that window rather than 30d-vs-prior-30d
    # (Codex review 1, must-fix #3 follow-through).
    OI_BUCKETS_PER_14D = 14 * 6  # 14 days × 6 four-hour buckets/day
    if len(data.oi) >= OI_BUCKETS_PER_14D * 2:
        oi_recent = data.oi[-OI_BUCKETS_PER_14D:]
        oi_prior = data.oi[-OI_BUCKETS_PER_14D * 2 : -OI_BUCKETS_PER_14D]
    else:
        # Defensive fallback when fewer than 28 days of OI are available.
        half = max(1, len(data.oi) // 2)
        oi_recent = data.oi[-half:]
        oi_prior = data.oi[-half * 2 : -half] if len(data.oi) >= half * 2 else data.oi[:half]
    if oi_prior and sum(oi_prior) > 0:
        oi_growth = (sum(oi_recent) - sum(oi_prior)) / sum(oi_prior)
    else:
        oi_growth = 0.0

    # Range compression: 30D true range / 30D MA close < 0.05
    if len(closes) >= 30:
        rng = max(closes[-30:]) - min(closes[-30:])
        avg = sum(closes[-30:]) / 30
        compression = (rng / avg) < 0.05 if avg > 0 else False
    else:
        compression = False

    abs_funding_now = abs(data.funding[-1]) if data.funding else 0.0
    abs_funding_history = [abs(f) for f in data.funding[-180:]]

    if len(volumes) >= 31:
        vol_avg_30d = sum(volumes[-31:-1]) / 30
        vol_ratio = volumes[-1] / vol_avg_30d if vol_avg_30d > 0 else 1.0
    else:
        vol_ratio = 1.0

    return {
        "rv_30d": rv_now,
        "rv_30d_history": rv_history,
        "bb_width": bb_now,
        "bb_width_history": bb_history,
        "atr_now": atr_now,
        "atr_history": atr_history,
        "oi_growth_pct": oi_growth,
        "price_range_compression": compression,
        "abs_funding": abs_funding_now,
        "abs_funding_history": abs_funding_history,
        "volume_ratio_30d": vol_ratio,
    }


def _build_derivatives_context(
    data: _AssetData, vol_ctx: VolatilityContext
) -> DerivativesEvidenceContext:
    global_history = _closed_ratio_history(data.global_long_short_ratio)[-30:]
    top_history = _closed_ratio_history(data.top_trader_position_ratio)[-30:]
    available_inputs = sum(
        (
            bool(data.oi),
            bool(data.funding),
            bool(global_history),
            bool(top_history),
        )
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


def _build_detail(
    asset: AssetSymbol,
    horizon: Horizon,
    data: _AssetData,
    generated_at: str,
    backtest_quality: float = DEFAULT_BACKTEST_QUALITY,
) -> PivotDetail:
    pp_score, pp_evidence = score_price_pivot(_build_market_context(data, horizon))
    vol_ctx = _build_volatility_context(data, horizon)
    vp_score, vp_evidence = score_volatility_pivot(vol_ctx)
    _, derivatives_evidence = score_derivatives_evidence(
        _build_derivatives_context(data, vol_ctx)
    )

    closes = data.closes
    near_support = closes[-1] <= min(closes[-30:]) * 1.02
    near_resistance = closes[-1] >= max(closes[-30:]) * 0.98
    bias = score_direction_bias({
        "rsi_14": rsi(closes, 14),
        "near_support": near_support,
        "near_resistance": near_resistance,
        "funding": data.funding[-1] if data.funding else 0.0,
        "macd_hist_recent": macd(closes)[2][-5:],
        "volatility_pivot_score": vp_score,
    })

    completeness = 100.0 if (data.oi and data.funding) else 60.0
    agreement = 100.0 - abs(pp_score - vp_score)
    conf_score, conf_grade = score_confidence({
        "data_completeness": completeness,
        "signal_agreement": agreement,
        "backtest_quality": backtest_quality,
    })

    overall = int(round(pp_score * 0.45 + vp_score * 0.45 + conf_score * 0.10))
    overall = max(0, min(100, overall))

    evidence = _append_derivatives_evidence(pp_evidence + vp_evidence, derivatives_evidence)
    headline, explanation = collect_summary(
        asset, horizon, pp_score, vp_score, bias, evidence
    )

    return {
        "asset": {"symbol": asset, "name": ASSET_NAMES[asset]},
        "horizon": horizon,
        "timestamp": generated_at,
        "scores": {
            "overall": float(overall),
            "price_pivot": float(pp_score),
            "volatility_pivot": float(vp_score),
            "confidence": {"grade": conf_grade, "score": float(conf_score)},
        },
        "direction_bias": bias,
        "evidence": evidence,
        "summary": {
            "level": score_level(overall),
            "headline": headline,
            "explanation": explanation,
        },
    }


def _build_radar_asset(
    asset: AssetSymbol, details: dict[str, PivotDetail]
) -> RadarAsset:
    radar_scores = {}
    for h in HORIZONS:
        d = details[detail_key(asset, h)]
        s = d["scores"]
        radar_scores[h] = {
            "overall": s["overall"],
            "price_pivot": s["price_pivot"],
            "volatility_pivot": s["volatility_pivot"],
            "confidence_grade": s["confidence"]["grade"],
            "main_signal": (
                "volatility" if s["volatility_pivot"] > s["price_pivot"] + 5
                else "price" if s["price_pivot"] > s["volatility_pivot"] + 5
                else "mixed"
            ),
        }
    return {"symbol": asset, "scores": radar_scores}


def compose_pivot_assets_snapshot(
    fetcher: BinanceFetcher,
    generated_at: str,
    backtest_quality_by_key: Mapping[BacktestQualityKey, float] | None = None,
) -> PivotAssetsSnapshot:
    quality = backtest_quality_by_key or {}
    asset_data = {a: _load(fetcher, a) for a in ASSETS}
    detail_map: dict[str, PivotDetail] = {}
    for a in ASSETS:
        for h in HORIZONS:
            detail_map[detail_key(a, h)] = _build_detail(
                a,
                h,
                asset_data[a],
                generated_at,
                quality.get((a, h), DEFAULT_BACKTEST_QUALITY),
            )
    radar = [_build_radar_asset(a, detail_map) for a in ASSETS]
    return {
        "schema_version": "v0.1",
        "generated_at": generated_at,
        "radar": radar,
        "detail": detail_map,
    }
