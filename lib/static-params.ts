/**
 * Build-time enumeration for generateStaticParams.
 *
 * ISR cost doctrine (2026-08-01): dynamic segments without
 * generateStaticParams render on-demand once per unique requested path, and
 * each render is a billed ISR write — crawler-probed junk paths included.
 * Enumerating the real id/slug sets at build (paired with
 * `dynamicParams = false` in the pages) prerenders every linkable detail
 * page and turns unknown paths into static 404s that never invoke a
 * function.
 *
 * Contract: enumeration matches the list SSOT each detail page is linked
 * from — intents are filtered to visibility === "public" exactly like
 * buildIntentListResponse (lib/intents-reader.ts). Data comes from the same
 * bundled files the pages read at request time, so build-time vs
 * request-time rendering yields identical content for a given deployment.
 */
import { getAllBriefs } from "@/lib/briefs";
import { readAndParseIntents, resolveIntentsPath } from "@/lib/intents-reader";
import { readAndParseSignals, resolveSignalsPath } from "@/lib/signals-reader";
import { TerminalAsset } from "@/lib/terminal/asset-summary";
import { AssetSymbolSchema } from "@/lib/pivots/types";

export function briefSlugParams(): Array<{ slug: string }> {
  return getAllBriefs().map((b) => ({ slug: b.slug }));
}

export function signalIdParams(): Array<{ id: string }> {
  // Reader collapses same-id rows to latest-wins; absent file → [] (the
  // legitimate pre-SDE state — detail paths then 404 like the list shows).
  const read = readAndParseSignals(resolveSignalsPath());
  return read.signals.map((s) => ({ id: s.id }));
}

export function intentIdParams(): Array<{ id: string }> {
  const read = readAndParseIntents(resolveIntentsPath());
  return read.intents
    .filter((i) => i.visibility === "public")
    .map((i) => ({ id: i.intent_id }));
}

/** /assets/{btc|eth|ada|night} — URLs are lowercase (see AssetDashboardCard). */
export function terminalAssetParams(): Array<{ asset: string }> {
  return TerminalAsset.options.map((a) => ({ asset: a.toLowerCase() }));
}

/** /turning-points/{btc|eth} — URLs are lowercase (see RadarTable). */
export function turningPointAssetParams(): Array<{ asset: string }> {
  return AssetSymbolSchema.options.map((a) => ({ asset: a.toLowerCase() }));
}
