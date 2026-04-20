/**
 * GET /api/intents/[id] — detail handler.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §3.2
 *
 * Loads Intents + Signals (both cached independently) and delegates to
 * buildIntentDetailResponse SSOT. not_found is 200 with status:"not_found"
 * (Task 1-3 pattern), I/O errors narrow-boundaried to 503.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  buildIntentDetailResponse,
  readAndParseIntents,
  resolveIntentsPath,
  type IntentsReadResult,
} from "@/lib/intents-reader";
import {
  readAndParseSignals,
  resolveSignalsPath,
  type ReadResult as SignalsReadResult,
} from "@/lib/signals-reader";

interface CachedRead<T> {
  value: T;
  fetchedAt: number;
}

// NOTE: Intentionally a route-scoped module cache, NOT the shared
// `IntentsCache` class in lib/intents-cache.ts. Accepts up to 60s of
// inter-endpoint state drift in exchange for simpler per-route lifecycles
// matching Task 1-3's /api/signals/[id] pattern. Convergence to a shared
// cache instance is deferred until we have evidence of drift causing user
// confusion (see Phase B quality review Critical #2).
let cachedIntents: CachedRead<IntentsReadResult> | null = null;
let cachedSignals: CachedRead<SignalsReadResult> | null = null;
const TTL_MS = 60_000;

function loadIntents(): IntentsReadResult {
  const now = Date.now();
  if (cachedIntents && now - cachedIntents.fetchedAt < TTL_MS) {
    return cachedIntents.value;
  }
  const value = readAndParseIntents(resolveIntentsPath());
  cachedIntents = { value, fetchedAt: now };
  return value;
}

function loadSignals(): SignalsReadResult {
  const now = Date.now();
  if (cachedSignals && now - cachedSignals.fetchedAt < TTL_MS) {
    return cachedSignals.value;
  }
  const value = readAndParseSignals(resolveSignalsPath());
  cachedSignals = { value, fetchedAt: now };
  return value;
}

function freshnessSec(mtimeMs: number | null): number {
  if (!mtimeMs) return -1;
  return Math.max(0, Math.floor((Date.now() - mtimeMs) / 1000));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  let intentsRead: IntentsReadResult;
  let signalsRead: SignalsReadResult;
  try {
    intentsRead = loadIntents();
    signalsRead = loadSignals();
  } catch (err) {
    console.error(
      "[api/intents/[id]] read failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "intents unavailable" },
      { status: 503 },
    );
  }

  const body = buildIntentDetailResponse(
    intentsRead.intents,
    signalsRead.signals,
    id,
    freshnessSec(intentsRead.mtimeMs),
  );

  const etagStamp = Math.floor(intentsRead.mtimeMs ?? 0);
  const etag = `W/"intent-detail-${id}-${etagStamp}"`;

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
