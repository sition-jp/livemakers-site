/**
 * GET /api/signals/[id]
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-task-1-3-signal-detail-design.md §5.3
 *
 * Thin HTTP wrapper around `buildSignalDetailResponse` — the single source of
 * truth for the detail response shape, shared with the SSR page component.
 * Own per-route in-memory cache (60s TTL, separate key from Task 1-2's list
 * cache). mtime-based weak ETag enables 304s from downstream caches.
 *
 * Error contract:
 * - File missing → 200 with chain_status="not_found" (not an error; handled
 *   inside readAndParseSignals via fileExists=false, propagated through
 *   buildSignalDetailResponse).
 * - Unexpected throw → 503 { error: "signals unavailable" }.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildSignalDetailResponse,
  readAndParseSignals,
  resolveSignalsPath,
} from "@/lib/signals-reader";
import type { Signal } from "@/lib/signals";

interface CachedRead {
  signals: Signal[];
  mtimeMs: number;
  fetchedAt: number;
}

// Module-level in-memory cache. Scope: per serverless invocation (matches
// Task 1-2's cache lifetime). Key separate from Task 1-2's signals-cache.
let cached: CachedRead | null = null;
const TTL_MS = 60_000;

function getSignals(): CachedRead {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < TTL_MS) return cached;
  const filePath = resolveSignalsPath();
  const result = readAndParseSignals(filePath);
  const mtimeMs = result.mtimeMs ?? 0;
  cached = { signals: result.signals, mtimeMs, fetchedAt: now };
  return cached;
}

function freshnessSec(mtimeMs: number): number {
  if (mtimeMs === 0) return -1;
  return Math.max(0, Math.floor((Date.now() - mtimeMs) / 1000));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const { signals, mtimeMs } = getSignals();
    const body = buildSignalDetailResponse(
      signals,
      params.id,
      freshnessSec(mtimeMs),
    );
    const etagStamp = mtimeMs === 0 ? "none" : String(mtimeMs);
    return NextResponse.json(body, {
      headers: {
        "Cache-Control":
          "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        ETag: `W/"sig-detail-${params.id}-${etagStamp}"`,
      },
    });
  } catch (err) {
    console.error(
      "[api/signals/[id]] failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "signals unavailable" },
      { status: 503 },
    );
  }
}
