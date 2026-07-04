import { z } from "zod";
import {
  marketLanesFixture,
  type MarketLane,
  type MarketLaneBadge,
  type MarketLaneTile,
  type MarketTickerItem,
} from "./market-lanes";

/**
 * G39-B B2: reads the SDE terminal feed (terminal_feed.public.json, delivered
 * to Vercel Blob by the SDE-side generator) and maps the macro/crypto lanes
 * plus the ticker onto the market-lane shapes. Strictly consuming:
 *
 * - the payload is validated with a strict zod schema — any unknown tile key,
 *   wrong type, or wrong schema_version rejects the whole payload and the
 *   caller falls back to the reviewed fixture (never a partial render);
 * - the RWA lane stays on the fixture until the B5 gap work provides data;
 * - unavailable values arrive as null and render as "—" (unavailable_not_zero);
 * - fetch failures fall back silently — the fixture with its FIXTURE badge is
 *   the honest degraded state (design §3-4).
 *
 * The Breaking Radar / published windows are NOT read from this feed in B2 —
 * those connect in B3/B4 behind the unmodified PR #13 validators.
 */

export const TERMINAL_FEED_ENV_KEY = "LIVEMAKERS_TERMINAL_FEED_URL";
export const TERMINAL_FEED_SCHEMA_VERSION = "livemakers_terminal_feed_v0.1";
export const TERMINAL_FEED_REVALIDATE_SECONDS = 300;

const localizedTextSchema = z.object({ en: z.string(), ja: z.string() });

const badgeSchema = z.enum(["SNAPSHOT", "SESSION", "FIXTURE"]);

const tileSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).max(32),
    value: z.string().min(1).max(32).nullable(),
    deltaPct: z.number().finite().optional(),
    note: localizedTextSchema,
    asOf: z.string().nullable(),
    badge: badgeSchema,
  })
  .strict();

const laneSchema = z
  .object({
    key: z.enum(["macro", "crypto", "rwa"]),
    badge: badgeSchema,
    tiles: z.array(tileSchema).min(1),
  })
  .strict();

const tickerItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).max(16),
    value: z.string().min(1).max(32),
    deltaPct: z.number().finite().optional(),
    asOf: z.string().nullable(),
    badge: badgeSchema,
  })
  .strict();

const terminalFeedSchema = z
  .object({
    schema_version: z.literal(TERMINAL_FEED_SCHEMA_VERSION),
    generated_at: z.string(),
    windows: z
      .object({
        macroLane: laneSchema,
        cryptoLane: laneSchema,
      })
      // liveRadar / published / scheduledSession stay unread until B3/B4.
      .passthrough(),
    ticker: z.array(tickerItemSchema),
  })
  .passthrough();

export interface LiveMarketData {
  lanes: MarketLane[];
  ticker: MarketTickerItem[];
  generatedAt: string;
}

/** "2026-07-04T07:30:00+09:00" → "2026-07-04 07:30 JST"; bare dates pass through. */
export function formatAsOfLabel(asOf: string | null): string | undefined {
  if (!asOf) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(asOf);
  if (!match) return undefined;
  return match[2] ? `${match[1]} ${match[2]} JST` : match[1];
}

type FeedTile = z.infer<typeof tileSchema>;

function mapTile(tile: FeedTile): MarketLaneTile {
  const mapped: MarketLaneTile = {
    id: tile.id,
    label: tile.label,
    value: tile.value,
    note: tile.note,
    badge: tile.badge,
  };
  if (tile.deltaPct !== undefined) mapped.deltaPct = tile.deltaPct;
  const asOfLabel = formatAsOfLabel(tile.asOf);
  if (asOfLabel) mapped.asOfLabel = asOfLabel;
  return mapped;
}

/**
 * Validate and map a terminal feed payload. Returns null when the payload is
 * not exactly what the contract promises — the caller keeps the fixture.
 */
export function mapTerminalFeed(payload: unknown): LiveMarketData | null {
  const parsed = terminalFeedSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { windows, ticker, generated_at: generatedAt } = parsed.data;
  if (windows.macroLane.key !== "macro" || windows.cryptoLane.key !== "crypto") {
    return null;
  }

  const rwaFixture = marketLanesFixture.find((lane) => lane.key === "rwa");
  if (!rwaFixture) return null;

  const lanes: MarketLane[] = [
    {
      key: "macro",
      badge: windows.macroLane.badge as MarketLaneBadge,
      tiles: windows.macroLane.tiles.map(mapTile),
    },
    {
      key: "crypto",
      badge: windows.cryptoLane.badge as MarketLaneBadge,
      tiles: windows.cryptoLane.tiles.map(mapTile),
    },
    // RWA stays on the reviewed fixture until B5 provides real sources.
    rwaFixture,
  ];

  const tickerItems: MarketTickerItem[] = ticker.map((item) => {
    const mapped: MarketTickerItem = {
      id: item.id,
      label: item.label,
      value: item.value,
      badge: item.badge,
    };
    if (item.deltaPct !== undefined) mapped.deltaPct = item.deltaPct;
    return mapped;
  });

  return { lanes, ticker: tickerItems, generatedAt };
}

/**
 * Server-side fetch of the delivered feed. Returns null (→ fixture fallback)
 * when the env URL is unset, the fetch fails, or the payload is invalid.
 * Next's data cache (revalidate) keeps the last good payload between
 * deliveries, which is the design §3-4 behaviour for delivery outages.
 */
export async function fetchLiveMarketData(): Promise<LiveMarketData | null> {
  const url = process.env[TERMINAL_FEED_ENV_KEY];
  if (!url) return null;
  try {
    const response = await fetch(url, {
      next: { revalidate: TERMINAL_FEED_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    return mapTerminalFeed(await response.json());
  } catch {
    return null;
  }
}
