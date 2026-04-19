/**
 * GET /api/signals — Signal feed endpoint.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-signals-api-and-card-ui-design.md §2
 *
 * Composition:
 *   signals-reader (pure fs + zod)
 *     → signals-cache (60s TTL, stale-on-error)
 *       → this route (HTTP contract: query params, sort, HTTP cache headers, ETag)
 *
 * Key contract decisions (mirror spec §2.5):
 * - file absent → 200 + empty signals, freshness -1. "SDE has not started" is
 *   an expected state, not a 4xx.
 * - per-line parse failure → skip + stderr log (handled in reader) + 200.
 * - every line broken (no salvageable signals + parse errors present) → 503.
 * - invalid query params → clamp or fall back to default, always 200.
 *
 * Cache strategy:
 * - In-memory SignalsCache, 60s TTL, inflight-dedup. The cache is module-
 *   scoped so the singleton survives across requests within one serverless
 *   invocation boundary.
 * - HTTP Cache-Control: public, max-age=30, s-maxage=60, stale-while-
 *   revalidate=120 — edge CDN may serve cached for 30s and stale for 120s
 *   while revalidating, matching the TTL above.
 * - mtime-based weak ETag: updates whenever SDE writes a new line; allows
 *   proxies/browsers to 304 when nothing changed.
 */
import { NextResponse } from "next/server";
import type { Signal } from "@/lib/signals";
import {
  readAndParseSignals,
  resolveSignalsPath,
  type ReadResult,
} from "@/lib/signals-reader";
import { SignalsCache } from "@/lib/signals-cache";

const SIGNAL_CACHE_TTL_SECONDS = 60;
const DEFAULT_MIN_CONFIDENCE = 0.65;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Path is re-resolved per fetcher invocation so that env-override tests
// (which mutate process.env between requests) are honoured without needing
// to swap the cache instance. Resolution is a cheap string ops; the file
// read that follows dominates.
const cache = new SignalsCache(SIGNAL_CACHE_TTL_SECONDS, async () => {
  const jsonlPath = resolveSignalsPath();
  return readAndParseSignals(jsonlPath);
});

const PILLAR_VALUES = new Set([
  "market_and_capital_flows",
  "ecosystem_health",
  "governance_and_treasury",
  "midnight_and_privacy",
  "risk_and_compliance",
  "project_research",
]);

const BUCKET_VALUES = new Set(["actionable", "active", "resolved", "all"]);

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseMinConfidence(raw: string | null): number {
  if (raw == null) return DEFAULT_MIN_CONFIDENCE;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_MIN_CONFIDENCE;
  return clamp(n, 0, 1);
}

function parseLimit(raw: string | null): number {
  if (raw == null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return clamp(Math.floor(n), 1, MAX_LIMIT);
}

/**
 * Default sort: confidence desc, created_at desc.
 * ISO 8601 timestamps are lexicographically comparable (when all UTC or all
 * same offset) so we can use string compare.
 */
function sortSignals(signals: Signal[]): Signal[] {
  return [...signals].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.created_at.localeCompare(a.created_at);
  });
}

function matchesBucket(s: Signal, bucket: string): boolean {
  if (bucket === "all") return true;
  if (bucket === "actionable") {
    return (
      s.status === "active" &&
      s.confidence >= 0.8 &&
      (s.impact === "high" || s.impact === "critical")
    );
  }
  if (bucket === "active") {
    if (s.status !== "active") return false;
    // active = everything active that is NOT actionable
    const isActionable =
      s.confidence >= 0.8 && (s.impact === "high" || s.impact === "critical");
    return !isActionable;
  }
  if (bucket === "resolved") {
    return (
      s.status === "expired" ||
      s.status === "invalidated" ||
      s.status === "superseded"
    );
  }
  return true;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const minConfidence = parseMinConfidence(url.searchParams.get("min_confidence"));
  const limit = parseLimit(url.searchParams.get("limit"));
  const pillarRaw = url.searchParams.get("pillar");
  const pillar = pillarRaw && PILLAR_VALUES.has(pillarRaw) ? pillarRaw : null;
  const primaryAsset = url.searchParams.get("primary_asset");
  const bucketRaw = url.searchParams.get("bucket");
  const bucket = bucketRaw && BUCKET_VALUES.has(bucketRaw) ? bucketRaw : "all";

  let result: ReadResult;
  try {
    result = await cache.get();
  } catch (err) {
    console.error(
      "[api/signals] cache fetcher threw:",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { error: "signals unavailable" },
      { status: 503 }
    );
  }

  const { signals: allSignals, parseErrors, fileExists, mtimeMs } = result;

  // 503 only when there is literally nothing to serve AND the file was
  // present AND every line we saw was broken. File-missing is a valid
  // "pre-launch" state (200 + empty).
  if (allSignals.length === 0 && fileExists && parseErrors.length > 0) {
    return NextResponse.json(
      { error: "signals unavailable" },
      { status: 503 }
    );
  }

  // total_active counts status=active before min_confidence filter per §2.3
  const totalActive = allSignals.filter((s) => s.status === "active").length;

  // Apply filters
  let filtered = allSignals.filter((s) => {
    if (s.confidence < minConfidence) return false;
    if (pillar && s.pillar !== pillar) return false;
    if (primaryAsset && s.primary_asset !== primaryAsset) return false;
    if (!matchesBucket(s, bucket)) return false;
    return true;
  });

  filtered = sortSignals(filtered);
  if (filtered.length > limit) filtered = filtered.slice(0, limit);

  const nowMs = Date.now();
  const sourceFreshnessSec =
    mtimeMs != null ? Math.floor((nowMs - mtimeMs) / 1000) : -1;

  const body = {
    signals: filtered,
    meta: {
      total_active: totalActive,
      returned: filtered.length,
      min_confidence: minConfidence,
      generated_at: new Date(nowMs).toISOString(),
      source_freshness_sec: sourceFreshnessSec,
    },
  };

  const etag = `W/"sig-${mtimeMs ?? 0}-${allSignals.length}"`;

  // If-None-Match support → 304 when nothing changed (cheap win for SWR
  // polling every 60s).
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        etag,
        "cache-control":
          "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
      },
    });
  }

  return NextResponse.json(body, {
    headers: {
      etag,
      "cache-control":
        "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
