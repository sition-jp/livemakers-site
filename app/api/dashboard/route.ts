/**
 * GET /api/dashboard — Terminal v2 four-asset overview.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §7
 *
 * Composition (mirrors /api/signals pattern):
 *   snapshot-reader (file read + zod validate)
 *     → this route (HTTP contract: ETag, 304, Cache-Control, degrade rules)
 *
 * Degrade matrix (spec §7.2):
 *   - file absent              → 200 + empty 4-asset skeleton, freshness=-1
 *   - schema violation         → 503 (builder produced unrecoverable output)
 *   - JSON malformed           → 503
 *   - happy path               → 200 + DashboardResponse + ETag
 */
import { NextResponse } from "next/server";
import { readTerminalAssetsSnapshot } from "@/lib/terminal/snapshot-reader";
import { emptyDashboardResponse } from "@/lib/terminal/empty";
import {
  DashboardResponseSchema,
  type DashboardResponse,
} from "@/lib/terminal/asset-summary";

const CACHE_CONTROL =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=120";

function makeEtag(mtimeMs: number | null, present: boolean): string {
  return `W/"dash-${mtimeMs ?? 0}-${present ? 1 : 0}"`;
}

export async function GET(req: Request): Promise<Response> {
  const result = await readTerminalAssetsSnapshot();

  // Degrade case: file absent → empty skeleton (200 OK).
  if (!result.fileExists && result.parseError === null) {
    const body = emptyDashboardResponse(new Date().toISOString());
    const etag = makeEtag(null, false);
    if (req.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { etag, "cache-control": CACHE_CONTROL },
      });
    }
    return NextResponse.json(body, {
      headers: { etag, "cache-control": CACHE_CONTROL },
    });
  }

  // Degrade case: file present but parse/schema failed → 503 (unrecoverable).
  if (result.snapshot === null) {
    return NextResponse.json(
      {
        error: "dashboard unavailable",
        reason: result.parseError ?? "unknown",
      },
      { status: 503 },
    );
  }

  // Happy path.
  const nowMs = Date.now();
  const sourceFreshnessSec =
    result.mtimeMs != null
      ? Math.floor((nowMs - result.mtimeMs) / 1000)
      : -1;

  const body: DashboardResponse = {
    assets: result.snapshot.assets,
    meta: {
      generated_at: new Date(nowMs).toISOString(),
      source_freshness_sec: sourceFreshnessSec,
      schema_version: "0.1",
    },
  };

  // Defensive: validate outgoing payload too. If we somehow constructed an
  // invalid response, fail loudly rather than ship bad data.
  const validated = DashboardResponseSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: "dashboard invariant", reason: "outgoing payload schema" },
      { status: 503 },
    );
  }

  const etag = makeEtag(result.mtimeMs, true);
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { etag, "cache-control": CACHE_CONTROL },
    });
  }

  return NextResponse.json(validated.data, {
    headers: { etag, "cache-control": CACHE_CONTROL },
  });
}
