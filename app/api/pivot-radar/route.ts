/**
 * GET /api/pivot-radar — AI Turning Point Detector radar endpoint.
 *
 * Spec: docs/ai_turning_point_detector_prd.md §21.1
 *
 * Composition mirrors /api/dashboard/live:
 *   readAssetsSnapshot (file + zod)
 *     → this route (HTTP contract: no-store, Server-Timing, degrade matrix)
 *
 * Response shape (PRD §21.1):
 *   { timestamp, assets: [{ symbol, scores: { 7D, 30D, 90D } }] }
 *
 * The materialised JSON stores `radar` and `detail` together; this route
 * surfaces only the radar slice.
 */
import { NextResponse } from "next/server";
import { readAssetsSnapshot } from "@/lib/pivots/pivots-reader";

const CACHE_CONTROL = "no-store";

function serverTimingHeader(readMs: number): string {
  return `read;dur=${readMs.toFixed(1)}`;
}

export async function GET(): Promise<Response> {
  const startedAt = performance.now();
  const result = await readAssetsSnapshot();
  const readMs = performance.now() - startedAt;

  const baseHeaders: Record<string, string> = {
    "cache-control": CACHE_CONTROL,
    "server-timing": serverTimingHeader(readMs),
  };

  if (!result.fileExists && result.parseError === null) {
    return NextResponse.json(
      { timestamp: new Date().toISOString(), assets: [] },
      { headers: baseHeaders },
    );
  }

  if (result.snapshot === null) {
    return NextResponse.json(
      {
        error: "pivot radar unavailable",
        reason: result.parseError ?? "unknown",
      },
      { status: 503, headers: baseHeaders },
    );
  }

  return NextResponse.json(
    {
      timestamp: result.snapshot.generated_at,
      assets: result.snapshot.radar,
    },
    { headers: baseHeaders },
  );
}
