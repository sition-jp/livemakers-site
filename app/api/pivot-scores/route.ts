/**
 * GET /api/pivot-scores?asset=<sym>&horizon=<h> — full asset detail.
 *
 * Spec: docs/ai_turning_point_detector_prd.md §21.2
 *
 * Returns the full detail block (overall + price/volatility pivot scores +
 * direction_bias + evidence[] + summary) for a single (asset, horizon).
 *
 * Query validation:
 *   - asset ∈ {BTC, ETH}
 *   - horizon ∈ {7D, 30D, 90D}
 *   - 400 on invalid params (PRD-compatible: detail endpoint, single record).
 *
 * 404 on unknown (asset, horizon) combination if the snapshot doesn't carry it.
 */
import { NextResponse } from "next/server";
import { readAssetsSnapshot } from "@/lib/pivots/pivots-reader";
import {
  AssetSymbolSchema,
  HorizonSchema,
  detailKey,
} from "@/lib/pivots/types";

const CACHE_CONTROL = "no-store";

function serverTimingHeader(readMs: number): string {
  return `read;dur=${readMs.toFixed(1)}`;
}

export async function GET(req: Request): Promise<Response> {
  const startedAt = performance.now();

  const url = new URL(req.url);
  const rawAsset = url.searchParams.get("asset");
  const rawHorizon = url.searchParams.get("horizon");

  const assetParse = AssetSymbolSchema.safeParse(rawAsset);
  const horizonParse = HorizonSchema.safeParse(rawHorizon);

  if (!assetParse.success || !horizonParse.success) {
    const readMs = performance.now() - startedAt;
    return NextResponse.json(
      {
        error: "invalid query parameters",
        details: {
          asset: assetParse.success ? "ok" : "must be BTC or ETH",
          horizon: horizonParse.success ? "ok" : "must be 7D, 30D, or 90D",
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

  const result = await readAssetsSnapshot();
  const readMs = performance.now() - startedAt;
  const baseHeaders: Record<string, string> = {
    "cache-control": CACHE_CONTROL,
    "server-timing": serverTimingHeader(readMs),
  };

  if (!result.fileExists && result.parseError === null) {
    return NextResponse.json(
      { error: "pivot scores unavailable", reason: "snapshot file absent" },
      { status: 503, headers: baseHeaders },
    );
  }

  if (result.snapshot === null) {
    return NextResponse.json(
      {
        error: "pivot scores unavailable",
        reason: result.parseError ?? "unknown",
      },
      { status: 503, headers: baseHeaders },
    );
  }

  const key = detailKey(assetParse.data, horizonParse.data);
  const detail = result.snapshot.detail[key];
  if (!detail) {
    return NextResponse.json(
      {
        error: "detail not found",
        asset: assetParse.data,
        horizon: horizonParse.data,
      },
      { status: 404, headers: baseHeaders },
    );
  }

  return NextResponse.json(detail, { headers: baseHeaders });
}
