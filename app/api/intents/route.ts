/**
 * GET /api/intents — list handler.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §3.1
 *
 * Delegates to buildIntentListResponse (SSOT, also called by /intents page).
 * Narrow I/O-only try/catch (Task 1-3 b146176 pattern); programmer errors
 * in the builder propagate as default Next.js 500.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildIntentListResponse,
  readAndParseIntents,
  resolveIntentsPath,
  type IntentsReadResult,
} from "@/lib/intents-reader";

interface CachedRead {
  value: IntentsReadResult;
  fetchedAt: number;
}

// NOTE: Intentionally a route-scoped module cache, NOT the shared
// `IntentsCache` class in lib/intents-cache.ts. Accepts up to 60s of
// inter-endpoint state drift in exchange for simpler per-route lifecycles
// matching Task 1-3's /api/signals/[id] pattern. Convergence to a shared
// cache instance is deferred until we have evidence of drift causing user
// confusion (see Phase B quality review Critical #2).
let cached: CachedRead | null = null;
const TTL_MS = 60_000;

function loadIntents(): IntentsReadResult {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < TTL_MS) return cached.value;
  const p = resolveIntentsPath();
  const value = readAndParseIntents(p);
  cached = { value, fetchedAt: now };
  return value;
}

function freshnessSec(mtimeMs: number | null): number {
  if (!mtimeMs) return -1;
  return Math.max(0, Math.floor((Date.now() - mtimeMs) / 1000));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let read: IntentsReadResult;
  try {
    read = loadIntents();
  } catch (err) {
    console.error(
      "[api/intents] read failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "intents unavailable" },
      { status: 503 },
    );
  }

  const body = buildIntentListResponse(
    read.intents,
    freshnessSec(read.mtimeMs),
  );
  const etagStamp = Math.floor(read.mtimeMs ?? 0);
  const etag = `W/"intents-list-${etagStamp}"`;

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        "Cache-Control":
          "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        ETag: etag,
      },
    });
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control":
        "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
      ETag: etag,
    },
  });
}
