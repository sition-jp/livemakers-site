/**
 * GET /api/assets/{btc|eth|ada|night}/summary — single-asset detail.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §7
 *
 * URL accepts lowercase or uppercase asset code; internal lookup uses the
 * uppercase canonical key (matches Signal `primary_asset` post-alias-map).
 *
 * Degrade matrix (mirrors /api/dashboard):
 *   - file absent              → 200 + empty AssetSummary skeleton
 *   - schema/JSON unrecoverable → 503
 *   - happy path               → 200 + AssetSummary + per-asset ETag
 */
import { NextResponse } from "next/server";
import { readTerminalAssetsSnapshot } from "@/lib/terminal/snapshot-reader";
import { emptyAssetSummary } from "@/lib/terminal/empty";
import {
  AssetSummarySchema,
  TerminalAsset,
  type TerminalAssetT,
} from "@/lib/terminal/asset-summary";

const CACHE_CONTROL =
  "public, max-age=30, s-maxage=60, stale-while-revalidate=120";

function makeEtag(
  asset: TerminalAssetT,
  mtimeMs: number | null,
  present: boolean,
): string {
  return `W/"asset-${asset}-${mtimeMs ?? 0}-${present ? 1 : 0}"`;
}

function normalizeAsset(raw: string): TerminalAssetT | null {
  const upper = raw.toUpperCase();
  const parsed = TerminalAsset.safeParse(upper);
  return parsed.success ? parsed.data : null;
}

interface RouteContext {
  params: Promise<{ asset: string }>;
}

export async function GET(
  req: Request,
  ctx: RouteContext,
): Promise<Response> {
  const { asset: rawAsset } = await ctx.params;
  const asset = normalizeAsset(rawAsset);

  if (asset === null) {
    return NextResponse.json(
      {
        error: `unknown asset '${rawAsset}'`,
        allowed: TerminalAsset.options,
      },
      { status: 400 },
    );
  }

  const result = await readTerminalAssetsSnapshot();

  // Degrade: file absent → empty asset skeleton (200).
  if (!result.fileExists && result.parseError === null) {
    const body = emptyAssetSummary(asset, new Date().toISOString());
    const etag = makeEtag(asset, null, false);
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

  // Degrade: file present but unrecoverable → 503.
  if (result.snapshot === null) {
    return NextResponse.json(
      {
        error: "asset summary unavailable",
        reason: result.parseError ?? "unknown",
      },
      { status: 503 },
    );
  }

  const summary = result.snapshot.assets[asset];

  // Defensive outgoing-payload validation.
  const validated = AssetSummarySchema.safeParse(summary);
  if (!validated.success) {
    return NextResponse.json(
      { error: "asset summary invariant", reason: "outgoing payload schema" },
      { status: 503 },
    );
  }

  const etag = makeEtag(asset, result.mtimeMs, true);
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
