/**
 * GET /api/backtests?asset=<sym>&horizon=<h>&score_type=<t>&threshold=<n>
 *
 * Spec: docs/ai_turning_point_detector_prd.md §21.3
 *
 * Codex review (Phase 1 plan):
 *   - 404 on unmatched (no fall-through to "empty metrics") so consumers
 *     surface the gap explicitly.
 *
 * Query validation:
 *   - asset ∈ {BTC, ETH}
 *   - horizon ∈ {7D, 30D, 90D}
 *   - score_type ∈ {overall, price_pivot, volatility_pivot}
 *   - threshold (number) optional — defaults to 70 per PRD §18
 */
import { NextResponse } from "next/server";
import { readBacktestSnapshot } from "@/lib/pivots/pivots-reader";
import {
  AssetSymbolSchema,
  HorizonSchema,
  ScoreTypeSchema,
} from "@/lib/pivots/types";

const CACHE_CONTROL = "no-store";
const DEFAULT_THRESHOLD = 70;

function serverTimingHeader(readMs: number): string {
  return `read;dur=${readMs.toFixed(1)}`;
}

export async function GET(req: Request): Promise<Response> {
  const startedAt = performance.now();

  const url = new URL(req.url);
  const assetParse = AssetSymbolSchema.safeParse(url.searchParams.get("asset"));
  const horizonParse = HorizonSchema.safeParse(
    url.searchParams.get("horizon"),
  );
  const scoreTypeParse = ScoreTypeSchema.safeParse(
    url.searchParams.get("score_type"),
  );

  const rawThreshold = url.searchParams.get("threshold");
  const threshold =
    rawThreshold === null ? DEFAULT_THRESHOLD : Number(rawThreshold);
  const thresholdValid =
    Number.isFinite(threshold) && threshold >= 0 && threshold <= 100;

  if (
    !assetParse.success ||
    !horizonParse.success ||
    !scoreTypeParse.success ||
    !thresholdValid
  ) {
    const readMs = performance.now() - startedAt;
    return NextResponse.json(
      {
        error: "invalid query parameters",
        details: {
          asset: assetParse.success ? "ok" : "must be BTC or ETH",
          horizon: horizonParse.success ? "ok" : "must be 7D, 30D, or 90D",
          score_type: scoreTypeParse.success
            ? "ok"
            : "must be overall, price_pivot, or volatility_pivot",
          threshold: thresholdValid ? "ok" : "must be a number 0-100",
        },
      },
      {
        status: 400,
        headers: {
          "cache-control": CACHE_CONTROL,
          "server-timing": serverTimingHeader(readMs),
        },
      },
    );
  }

  const result = await readBacktestSnapshot();
  const readMs = performance.now() - startedAt;
  const baseHeaders: Record<string, string> = {
    "cache-control": CACHE_CONTROL,
    "server-timing": serverTimingHeader(readMs),
  };

  if (!result.fileExists && result.parseError === null) {
    return NextResponse.json(
      { error: "backtest snapshot unavailable", reason: "snapshot file absent" },
      { status: 503, headers: baseHeaders },
    );
  }

  if (result.snapshot === null) {
    return NextResponse.json(
      {
        error: "backtest snapshot unavailable",
        reason: result.parseError ?? "unknown",
      },
      { status: 503, headers: baseHeaders },
    );
  }

  const entry = result.snapshot.entries.find(
    (e) =>
      e.asset === assetParse.data &&
      e.horizon === horizonParse.data &&
      e.score_type === scoreTypeParse.data &&
      e.threshold === threshold,
  );

  if (!entry) {
    return NextResponse.json(
      {
        error: "backtest entry not found",
        asset: assetParse.data,
        horizon: horizonParse.data,
        score_type: scoreTypeParse.data,
        threshold,
      },
      { status: 404, headers: baseHeaders },
    );
  }

  return NextResponse.json(
    {
      asset: entry.asset,
      horizon: entry.horizon,
      score_type: entry.score_type,
      threshold: entry.threshold,
      period: entry.period,
      metrics: entry.metrics,
    },
    { headers: baseHeaders },
  );
}
