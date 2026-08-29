import { z } from "zod";
import {
  CHARTABLE_INSTRUMENTS,
  INSTRUMENT_DISPLAY_NAMES_JA,
  type InstrumentId,
} from "@/lib/home/instruments";
import {
  MarketSnapshotCellSchema,
  type MarketSnapshotCell,
} from "@/lib/home/market-snapshot";
import { validateBreakingRadarTitleWindow } from "@/lib/livemakers-terminal-preview/breaking-radar-title-window";
import type {
  LocalizedText,
  TerminalLiveRadarItem,
} from "@/lib/livemakers-terminal-preview/types";
import { findLiveTokenViolations, matchesTerm } from "@/lib/home/matches-term";
import type { ProvenanceState } from "@/lib/provenance/window-provenance";
import type { FocusSeries } from "@/lib/sessions/focus-series";
import {
  SessionMetaSchema,
  editorialUrlOrHandleMatches,
  type SessionRecordMeta,
} from "@/lib/sessions/session-content";
import type { ReaderSessionSlug } from "@/lib/sessions/session-registry";
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
 * - the RWA lane (B5) reads the delivered payload (RWA TVL live; TOKENIZED
 *   STOCKS still "—"); an invalid section falls back to the reviewed fixture;
 * - unavailable values arrive as null and render as "—" (unavailable_not_zero);
 * - fetch failures fall back silently — the fixture with its FIXTURE badge is
 *   the honest degraded state (design §3-4).
 *
 * G39-B B3: the Live Radar window and the scheduled-session times are read
 * from the same payload, gated by the UNMODIFIED PR #13 validator
 * (validateBreakingRadarTitleWindow) on top of a strict zod schema. Radar
 * degradation is independent: an invalid radar section nulls only
 * `liveRadar` (the window keeps its reviewed fixture) while the market
 * lanes and ticker stay live.
 *
 * G39-B B4: the published_log projection (X-published intelligence) is read
 * as `published` — the secondary feed under the site-native brief list. It is
 * the only external-link surface, so its urls are host-allowlisted; a
 * malformed section nulls only `published` (the site-native briefs still
 * render). The site-native primary feed is built separately at request time
 * from the on-disk briefs (see lib/terminal/published-window.ts).
 */

export const TERMINAL_FEED_ENV_KEY = "LIVEMAKERS_TERMINAL_FEED_URL";
export const TERMINAL_FEED_SCHEMA_V01 = "livemakers_terminal_feed_v0.1";
export const TERMINAL_FEED_SCHEMA_V02 = "livemakers_terminal_feed_v0.2";
// G43-d T1: v0.3 is additive over v0.2 (home stays fully supported) and adds
// the optional top-level `radar` bundle (see radarBundleSchema / mapRadarBundle).
export const TERMINAL_FEED_SCHEMA_V03 = "livemakers_terminal_feed_v0.3";
export const TERMINAL_FEED_SCHEMA_V04 = "livemakers_terminal_feed_v0.4";
export const TERMINAL_FEED_SCHEMA_VERSION = TERMINAL_FEED_SCHEMA_V01;
// ISR cost doctrine (2026-08-01): the feed is delivered to Blob hourly
// (crontab :45), so a 300s revalidate meant 12 regenerations per delivery
// with identical upstream data. This fetch runs in the [locale] layout, so
// its revalidate becomes the ISR interval for EVERY page on the site —
// 3600s matches the actual delivery cadence and cuts ISR writes ~12x.
// Client-side live surfaces (/api/dashboard/live no-store, /api/ticker,
// SWR polling) are unaffected.
export const TERMINAL_FEED_REVALIDATE_SECONDS = 3600;

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

const radarItemSchema = z
  .object({
    id: z.string().min(1),
    sourceLane: z.enum([
      "x_news_trends",
      "sde_phase1_breaking_radar",
      "manual_operator_observation",
    ]),
    sourceLabel: localizedTextSchema,
    family: z.string().min(1),
    title: localizedTextSchema,
    status: z.enum(["breaking", "checking", "sde_review_pending"]),
    freshnessLabel: localizedTextSchema,
    displayMode: z.literal("title_only"),
    publishDecision: z.literal("not_authorized"),
    href: z.null(),
  })
  .strict();

const liveRadarWindowSchema = z
  .object({
    title: localizedTextSchema,
    badge: badgeSchema,
    asOf: z.string().nullable(),
    items: z.array(radarItemSchema).min(1),
  })
  .strict();

const scheduledSessionSchema = z
  .object({
    lastCompletedAt: z.string().nullable(),
    nextScheduledAt: z.string().nullable(),
  })
  .strict();

/**
 * G39-B B4: the published_log projection (X-published intelligence). This is
 * the secondary feed under the site-native brief list, and the only external
 * link surface in the whole terminal — so the url is host-allowlisted to the
 * accounts SITION actually publishes from. Anything else rejects the whole
 * section (never a partial external-link render).
 */
const PUBLISHED_URL_ALLOWLIST =
  /^https:\/\/(www\.)?(x\.com|twitter\.com|sipo\.tokyo|livemakers\.com)\/[^\s]*$/;

const publishedPostSchema = z
  .object({
    account: z.string().min(1).max(40),
    date: z.string().min(1).max(32),
    title: z.string().min(1).max(280),
    type: z.string().min(1).max(40),
    url: z.string().regex(PUBLISHED_URL_ALLOWLIST),
  })
  .strict();

const publishedWindowSchema = z
  .object({
    title: localizedTextSchema,
    items: z.array(publishedPostSchema),
  })
  .strict();

export const forbiddenSourceVisibleText = [
  "site_publish_log",
  "published_log",
  "publish_audit",
  "publish_candidates",
  "article_queue",
  "07_DATA",
  "operator",
  "draft",
  "review-packet",
  "file://",
  "/Users/",
  "http://",
  "https://",
  "raw X",
  "screenshot",
];

export const forbiddenSourceOpsTerms = [
  "crawler",
  "crawl",
  "chrome mcp",
  "cloudflare",
  "fallback",
  "partial_success",
  "coverage",
  "checkpoint",
  "watchlist",
  "websearch",
  "source queue",
  "rate_limit",
  "rate limit",
  "disposition",
  "freshness_tier",
  "raw_intelligence",
  "query_group",
  "twitterapi",
  "phase 1",
  "phase 2",
  "phase1",
  "phase2",
  "jsonl",
];

// URL / ハンドルの検出は session-content.ts の editorialUrlOrHandleMatches が
// 正本 (P2-5)。同型 regex をここにも置いていたため、片方だけ較正される事故の
// 芽になっていた。sourceDomainPattern は用途が違う (完全一致判定) ので残す。
const sourceDomainPattern =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

function sourceVisibleTextViolations(value: string): string[] {
  const found = forbiddenSourceVisibleText.filter((fragment) =>
    value.includes(fragment),
  );
  const lower = value.toLowerCase();
  return found.concat(
    forbiddenSourceOpsTerms.filter((term) => lower.includes(term)),
  );
}

const sourceTitleTextSchema = z
  .string()
  .min(1)
  .max(160)
  .superRefine((value, ctx) => {
    const visibleViolations = sourceVisibleTextViolations(value);
    const patternViolations = editorialUrlOrHandleMatches(value);
    if (visibleViolations.length > 0 || patternViolations.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unsafe source title",
      });
    }
  });

const sourceLocalizedTitleSchema = z
  .object({ en: sourceTitleTextSchema, ja: sourceTitleTextSchema })
  .strict();

const sourceVisibleTextSchema = z
  .string()
  .min(1)
  .max(120)
  .superRefine((value, ctx) => {
    if (sourceVisibleTextViolations(value).length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unsafe source visible text",
      });
    }
  });

const sourceLocalizedVisibleSchema = z
  .object({ en: sourceVisibleTextSchema, ja: sourceVisibleTextSchema })
  .strict();

const sourceDomainSchema = z
  .string()
  .min(1)
  .max(120)
  .superRefine((value, ctx) => {
    if (
      sourceVisibleTextViolations(value).length > 0 ||
      value.includes("/") ||
      value.startsWith("@") ||
      !sourceDomainPattern.test(value)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sourceDomain must be a bare host",
      });
    }
  });

const sourceItemSchema = z
  .object({
    id: z.string().min(1),
    title: sourceLocalizedTitleSchema,
    sourceDomain: sourceDomainSchema,
    category: sourceLocalizedVisibleSchema,
    freshnessLabel: sourceLocalizedVisibleSchema,
  })
  .strict();

const sourceWindowSchema = z
  .object({
    title: localizedTextSchema,
    badge: badgeSchema,
    asOf: z.string().nullable(),
    items: z.array(sourceItemSchema).min(1),
  })
  .strict();

const JST_ISO_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\+09:00$/;
const PAGE_PACKET_PATTERN = /^lmk_(\d{8})_(\d{4})_[a-z0-9]+$/;
const MARKET_PACKET_PATTERN =
  /^mkt12_(\d{8})_(asia|am|europe|ny|close)$/;
const RADAR_PACKET_PATTERN = /^radar_\d{8}_\d{4}_[a-z0-9]+$/;
const SESSIONS_PACKET_PATTERN = /^sess_\d{8}_\d{4}_[0-9a-f]{8}$/;

const MARKET_ANCHORS = {
  asia: "05:03",
  am: "07:30",
  europe: "12:03",
  ny: "18:03",
  close: "23:03",
} as const;

function validatePacketAnchor(home: {
  dataDate: string;
  asOfJst: string;
  pagePacketId: string;
  marketPacketId: string;
}): string | null {
  const market = MARKET_PACKET_PATTERN.exec(home.marketPacketId);
  const page = PAGE_PACKET_PATTERN.exec(home.pagePacketId);
  if (!market || !page) return "packet pattern mismatch";
  const suffix = market[2] as keyof typeof MARKET_ANCHORS;
  const anchorMs = Date.parse(
    `${home.dataDate}T${MARKET_ANCHORS[suffix]}:00+09:00`,
  );
  const asOfMs = Date.parse(home.asOfJst);
  if (asOfMs < anchorMs || asOfMs > anchorMs + 7 * 60 * 1000) {
    return "home asOfJst is outside semantic anchor completion window";
  }
  if (page[2] !== home.asOfJst.slice(11, 16).replace(":", "")) {
    return "pagePacketId HHmm must equal home asOfJst";
  }
  return null;
}

const homeSeriesPointSchema = z
  .object({
    atJst: z.string().regex(JST_ISO_PATTERN),
    value: z.number().finite().positive(),
  })
  .strict();

const homeFocusSeriesSchema = z
  .object({
    instrumentId: z.enum(CHARTABLE_INSTRUMENTS),
    seriesPacketId: z.string().min(1),
    points: z.array(homeSeriesPointSchema).min(2).max(6),
  })
  .strict();

const homeFocusSessionSchema = z
  .object({
    sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sessionSlug: z.enum([
      "asia-open",
      "europe-bridge",
      "ny-open",
      "global-close",
    ]),
    focusInstruments: z
      .array(z.enum(CHARTABLE_INSTRUMENTS))
      .min(2)
      .max(3),
    series: z.array(homeFocusSeriesSchema).min(2).max(3),
  })
  .strict();

const reviewedHomeSchema = z
  .object({
    pagePacketId: z.string().regex(PAGE_PACKET_PATTERN),
    marketPacketId: z.string().regex(MARKET_PACKET_PATTERN),
    asOfJst: z.string().regex(JST_ISO_PATTERN),
    dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sourceMode: z.literal("reviewed_live"),
    reviewStatus: z.literal("reviewed_snapshot"),
    cells: z.array(MarketSnapshotCellSchema).length(
      CHARTABLE_INSTRUMENTS.length,
    ),
    focusSession: homeFocusSessionSchema,
  })
  .strict()
  .superRefine((home, context) => {
    const compactDate = home.dataDate.replaceAll("-", "");
    if (!home.asOfJst.startsWith(`${home.dataDate}T`)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "home asOfJst date must equal dataDate",
      });
    }
    if (PAGE_PACKET_PATTERN.exec(home.pagePacketId)?.[1] !== compactDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pagePacketId date must equal dataDate",
      });
    }
    if (MARKET_PACKET_PATTERN.exec(home.marketPacketId)?.[1] !== compactDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "marketPacketId date must equal dataDate",
      });
    }
    const packetAnchorError = validatePacketAnchor(home);
    if (packetAnchorError) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: packetAnchorError,
      });
    }

    const actualIds = home.cells.map((cell) => cell.instrumentId);
    if (
      actualIds.length !== CHARTABLE_INSTRUMENTS.length ||
      actualIds.some(
        (instrumentId, index) =>
          instrumentId !== CHARTABLE_INSTRUMENTS[index],
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "home cells must equal the ordered chartable registry",
      });
    }
    for (const cell of home.cells) {
      if (cell.nameJa !== INSTRUMENT_DISPLAY_NAMES_JA[cell.instrumentId]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `home cell display name mismatch: ${cell.instrumentId}`,
        });
      }
    }

    if (home.focusSession.sessionDate !== home.dataDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "focus session date must equal dataDate",
      });
    }
    const focusIds = home.focusSession.focusInstruments;
    if (new Set(focusIds).size !== focusIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "focus instruments must be unique",
      });
    }
    const seriesIds = home.focusSession.series.map(
      (series) => series.instrumentId,
    );
    if (
      focusIds.length !== seriesIds.length ||
      focusIds.some((instrumentId, index) => instrumentId !== seriesIds[index])
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "focus series must match focus instruments in order",
      });
    }

    const endMs = new Date(home.asOfJst).getTime();
    const startMs = endMs - 24 * 60 * 60 * 1000;
    for (const series of home.focusSession.series) {
      if (
        series.seriesPacketId !==
        `series.${home.dataDate}.${series.instrumentId}`
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `series packet mismatch: ${series.instrumentId}`,
        });
      }
      let previous = -Infinity;
      for (const point of series.points) {
        const timestamp = new Date(point.atJst).getTime();
        if (
          !Number.isFinite(timestamp) ||
          timestamp <= previous ||
          timestamp < startMs ||
          timestamp > endMs
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `invalid focus point window/order: ${series.instrumentId}`,
          });
        }
        previous = timestamp;
      }
    }
  });

/**
 * G43-d: the feed `radar` bundle (site-first speed-radar consumer). A
 * top-level v0.3-only section, parsed separately from terminalFeedSchema —
 * same independent-degradation posture as home/liveRadar/published: an
 * invalid bundle nulls only `radar`, never the rest of the feed.
 *
 * The per-observation shape mirrors lib/home/radar-observations.ts's
 * RadarObservationSchema (+ observedAtJst). It is duplicated here rather
 * than imported to avoid a circular dependency — radar-observations.ts
 * already imports forbiddenSourceOpsTerms/forbiddenSourceVisibleText FROM
 * this file.
 */
// 2026-08-14 田平氏裁定: 観測は一次ソースへ外部リンク可 (同日 GO で X 限定 →
// 一般 https へ拡張・構造検査のみ。設計理由は radar-observations.ts 参照)。
// lib/home/radar-observations.ts の RADAR_SOURCE_URL_ALLOWLIST の鏡 —
// import すると循環参照になるためここに複製する (上の schema 複製と同じ理由)。
const RADAR_SOURCE_URL_ALLOWLIST_MIRROR =
  /^https:\/\/[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}(?:\/\S*)?$/;
const RADAR_SOURCE_URL_MAX_LENGTH_MIRROR = 600;

const radarBundleObservationSchema = z
  .object({
    topicId: z.string().min(1),
    lane: z.enum([
      "x_news_trends",
      "sde_phase1_breaking_radar",
      "manual_operator_observation",
    ]),
    titleJa: z.string().min(1),
    observedAtLabel: z.string().regex(/^\d{2}:\d{2}$/),
    observedAtJst: z.string().regex(JST_ISO_PATTERN),
    href: z.union([
      z.null(),
      z
        .string()
        .max(RADAR_SOURCE_URL_MAX_LENGTH_MIRROR)
        .regex(RADAR_SOURCE_URL_ALLOWLIST_MIRROR),
    ]),
    displayMode: z.enum(["title_only", "title_with_source"]),
    publishDecision: z.literal("not_authorized"),
  })
  .strict()
  .superRefine((observation, ctx) => {
    // displayMode は href の有無の鏡 (radar-observations.ts と同一契約)。
    const linked = observation.href !== null;
    if (linked !== (observation.displayMode === "title_with_source")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "displayMode must mirror href presence",
        path: ["displayMode"],
      });
    }
  });

const radarBundleSchema = z
  .object({
    schemaVersion: z.literal("livemakers_radar_v1"),
    packetId: z.string().regex(RADAR_PACKET_PATTERN),
    asOfJst: z.string().regex(JST_ISO_PATTERN),
    observations: z.array(radarBundleObservationSchema),
    promotions: z.record(z.string().min(1), z.string().min(1)),
    truncated: z.boolean(),
  })
  .strict()
  // G43-d (fix round 1): a duplicate topicId is malformed, not just
  // undesirable — reject via the same fail-closed posture as every other
  // radar bundle check (safeParse failure → mapRadarBundle returns null →
  // independent degradation nulls only `radar`, never a throw).
  .superRefine((bundle, ctx) => {
    const seen = new Set<string>();
    for (const observation of bundle.observations) {
      if (seen.has(observation.topicId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate radar observation topicId: ${observation.topicId}`,
          path: ["observations"],
        });
        return;
      }
      seen.add(observation.topicId);
    }
  });

export type RadarFeedObservation = z.infer<typeof radarBundleObservationSchema>;

export interface RadarFeedData {
  observations: RadarFeedObservation[];
  promotions: Readonly<Record<string, string>>;
}

/**
 * Validate and map the radar bundle. Returns null (→ the caller falls back
 * to an honest empty radar/promotions pair, never a stale fixture) unless
 * the strict schema passes AND every titleJa clears the same word-boundary
 * forbidden-vocabulary scan used by assertRadarObservationContract — one
 * violation nulls the whole bundle (fail-closed, never a partial radar).
 */
function mapRadarBundle(section: unknown): RadarFeedData | null {
  const parsed = radarBundleSchema.safeParse(section);
  if (!parsed.success) return null;
  for (const observation of parsed.data.observations) {
    const lower = observation.titleJa.toLowerCase();
    for (const term of [
      ...forbiddenSourceVisibleText,
      ...forbiddenSourceOpsTerms,
    ]) {
      if (matchesTerm(lower, term.toLowerCase())) return null;
    }
  }
  return {
    observations: parsed.data.observations,
    promotions: parsed.data.promotions,
  };
}

/**
 * G43-e (S2): the feed `sessions` bundle (site-first live-session consumer).
 * A top-level v0.3-only section, same independent-degradation posture as
 * radar/home/liveRadar/published: an invalid bundle nulls only `sessions`,
 * never the rest of the feed. Records are validated with the SITE-side
 * SessionMetaSchema verbatim (imported, not duplicated) so the wire contract
 * and the on-disk repo contract can never drift apart.
 *
 * Four additional fail-closed checks beyond SessionMetaSchema itself, all
 * pre-crystallize wire-contract requirements (crystallize — materializing a
 * feed session into a repo content/sessions/ directory — is a separate,
 * not-yet-wired gate):
 *  - every record's `date` normally equals the bundle's `asOfJst` calendar
 *    date; v0.4 alone permits one previous-day global-close through 05:02;
 *  - every record's `articleStatus` must be "pending" (a "published" record
 *    arriving over the feed would imply crystallize already happened, which
 *    this wire contract does not yet support — reject rather than trust);
 *  - no two records may share the same `sessionId` (fix round 2 / I-3 —
 *    a duplicate id is malformed, not just undesirable);
 *  - at most one record may declare `liveStatus === "live"` (fix round 2 /
 *    I-3 — the site only ever surfaces a single "いまのセッション" slot, so a
 *    bundle claiming two simultaneous live sessions is malformed).
 */
const sessionsBundleSchema = z
  .object({
    schemaVersion: z.literal("livemakers_sessions_v1"),
    packetId: z.string().regex(SESSIONS_PACKET_PATTERN),
    asOfJst: z.string().regex(JST_ISO_PATTERN),
    records: z.array(SessionMetaSchema).max(4),
  })
  .strict()
  .superRefine((bundle, ctx) => {
    const bundleDate = bundle.asOfJst.slice(0, 10);
    const seenSessionIds = new Set<string>();
    let liveCount = 0;
    bundle.records.forEach((record, index) => {
      if (record.articleStatus !== "pending") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `session record articleStatus must be pending pre-crystallize: ${record.sessionId}`,
          path: ["records", index, "articleStatus"],
        });
      }
      if (seenSessionIds.has(record.sessionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate session record sessionId: ${record.sessionId}`,
          path: ["records", index, "sessionId"],
        });
      }
      seenSessionIds.add(record.sessionId);
      if (record.liveStatus === "live") {
        liveCount += 1;
      }
    });
    if (liveCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `sessions bundle may declare at most one live record, found ${liveCount}`,
        path: ["records"],
      });
    }
  });

export interface SessionsFeedData {
  records: SessionRecordMeta[];
}

/**
 * Validate and map the sessions bundle. Returns null (→ the caller falls
 * back to the repo-only session state, never a stale/mixed record) unless
 * the strict schema passes AND every record's titleJa + bullets[] clears the
 * same word-boundary forbidden-vocabulary scan mapRadarBundle applies to
 * titleJa, plus the reader-grammar LIVE-token check (fix round 2 / I-1) —
 * one violation anywhere nulls the whole bundle (fail-closed, never a
 * partial sessions render).
 */
function previousIsoDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function isAllowedSessionRecordDate(
  record: SessionRecordMeta,
  bundleAsOfJst: string,
  allowPreviousGlobalClose: boolean,
): boolean {
  const bundleDate = bundleAsOfJst.slice(0, 10);
  if (record.date === bundleDate) return true;
  if (!allowPreviousGlobalClose) return false;
  const hhmm = bundleAsOfJst.slice(11, 16);
  return (
    record.sessionSlug === "global-close" &&
    record.date === previousIsoDate(bundleDate) &&
    hhmm <= "05:02"
  );
}

function mapSessionsBundle(
  section: unknown,
  options: {
    allowEditorial: boolean;
    allowPreviousGlobalClose: boolean;
  },
): SessionsFeedData | null {
  const parsed = sessionsBundleSchema.safeParse(section);
  if (!parsed.success) return null;
  if (
    options.allowEditorial &&
    !parsed.data.records.some((record) => record.editorial !== undefined)
  ) {
    return null;
  }
  let previousGlobalCloseCount = 0;
  for (const record of parsed.data.records) {
    if (record.editorial && !options.allowEditorial) return null;
    if (
      !isAllowedSessionRecordDate(
        record,
        parsed.data.asOfJst,
        options.allowPreviousGlobalClose,
      )
    ) {
      return null;
    }
    if (record.date !== parsed.data.asOfJst.slice(0, 10)) {
      previousGlobalCloseCount += 1;
      if (previousGlobalCloseCount > 1) return null;
    }
    const editorialText = record.editorial
      ? [
          record.editorial.lead,
          ...record.editorial.items.flatMap((item) =>
            item.note ? [item.headline, item.note] : [item.headline],
          ),
          ...record.editorial.watch,
        ]
      : [];
    for (const text of [record.titleJa, ...record.bullets, ...editorialText]) {
      const lower = text.toLowerCase();
      for (const term of [
        ...forbiddenSourceVisibleText,
        ...forbiddenSourceOpsTerms,
      ]) {
        if (matchesTerm(lower, term.toLowerCase())) return null;
      }
      if (findLiveTokenViolations(text).length > 0) return null;
      if (editorialUrlOrHandleMatches(text).length > 0) return null;
    }
  }
  return { records: parsed.data.records };
}

const terminalFeedSchema = z
  .object({
    schema_version: z.enum([
      TERMINAL_FEED_SCHEMA_V01,
      TERMINAL_FEED_SCHEMA_V02,
      TERMINAL_FEED_SCHEMA_V03,
      TERMINAL_FEED_SCHEMA_V04,
    ]),
    generated_at: z.string(),
    windows: z
      .object({
        macroLane: laneSchema,
        cryptoLane: laneSchema,
      })
      // liveRadar / scheduledSession / published are parsed separately
      // (independent degradation — see mapLiveRadar / mapPublished).
      .passthrough(),
    ticker: z.array(tickerItemSchema),
  })
  .passthrough();

export interface LiveRadarData {
  items: TerminalLiveRadarItem[];
  badge: MarketLaneBadge;
  asOfLabel?: string;
}

export interface ScheduledSessionTimes {
  lastCompletedLabel?: string;
  nextScheduledLabel?: string;
}

export interface PublishedPost {
  account: string;
  date: string;
  title: string;
  type: string;
  url: string;
}

export interface PublishedFeedData {
  items: PublishedPost[];
}

export interface SourceFeedItem {
  id: string;
  title: LocalizedText;
  sourceDomain: string;
  category: LocalizedText;
  freshnessLabel: LocalizedText;
}

export interface SourceFeedData {
  title: LocalizedText;
  badge: MarketLaneBadge;
  asOfLabel?: string;
  items: SourceFeedItem[];
}

export interface ReviewedHomeData {
  cells: MarketSnapshotCell[];
  pagePacketId: string;
  marketPacketId: string;
  asOfJst: string;
  dataDate: string;
  focusSession: {
    sessionDate: string;
    sessionSlug: ReaderSessionSlug;
    focusInstruments: InstrumentId[];
    series: FocusSeries[];
  };
  provenance: Extract<
    ProvenanceState,
    { sourceMode: "reviewed_live" }
  >;
}

export interface LiveMarketData {
  lanes: MarketLane[];
  ticker: MarketTickerItem[];
  generatedAt: string;
  liveRadar: LiveRadarData | null;
  scheduledSession: ScheduledSessionTimes | null;
  published: PublishedFeedData | null;
  source: SourceFeedData | null;
  home: ReviewedHomeData | null;
  radar: RadarFeedData | null;
  sessions: SessionsFeedData | null;
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
 * G39-B B5: map the RWA lane from the delivered payload (RWA TVL is now live
 * via the isolated collector; TOKENIZED STOCKS stays unavailable → "—").
 * Returns null on any schema mismatch → the caller keeps the reviewed RWA
 * fixture (independent degradation, same posture as macro/crypto/radar).
 */
function mapRwaLane(section: unknown): MarketLane | null {
  const parsed = laneSchema.safeParse(section);
  if (!parsed.success || parsed.data.key !== "rwa") return null;
  return {
    key: "rwa",
    badge: parsed.data.badge as MarketLaneBadge,
    tiles: parsed.data.tiles.map(mapTile),
  };
}

/**
 * Validate and map the radar section. Returns null (→ the window keeps its
 * reviewed fixture) unless the strict schema AND the unmodified PR #13
 * validator both pass. Never a partial radar render.
 */
function mapLiveRadar(section: unknown): LiveRadarData | null {
  const parsed = liveRadarWindowSchema.safeParse(section);
  if (!parsed.success) return null;
  const errors = validateBreakingRadarTitleWindow({
    title: parsed.data.title,
    items: parsed.data.items,
  });
  if (errors.length > 0) return null;
  const radar: LiveRadarData = {
    items: parsed.data.items,
    badge: parsed.data.badge as MarketLaneBadge,
  };
  const asOfLabel = formatAsOfLabel(parsed.data.asOf);
  if (asOfLabel) radar.asOfLabel = asOfLabel;
  return radar;
}

function mapScheduledSession(section: unknown): ScheduledSessionTimes | null {
  const parsed = scheduledSessionSchema.safeParse(section);
  if (!parsed.success) return null;
  const times: ScheduledSessionTimes = {};
  const last = formatAsOfLabel(parsed.data.lastCompletedAt);
  const next = formatAsOfLabel(parsed.data.nextScheduledAt);
  if (last) times.lastCompletedLabel = last;
  if (next) times.nextScheduledLabel = next;
  return last || next ? times : null;
}

/**
 * Validate and map the published (X) section. Returns null (→ the window shows
 * only the site-native brief feed) unless every item passes the strict schema
 * — including the url host allowlist. An empty list also returns null: no
 * secondary feed rather than an empty heading.
 */
function mapPublished(section: unknown): PublishedFeedData | null {
  const parsed = publishedWindowSchema.safeParse(section);
  if (!parsed.success) return null;
  if (parsed.data.items.length === 0) return null;
  return { items: parsed.data.items };
}

/**
 * G39 v1.5 / Plan B: map the SDE Plan A `windows.source` projection.
 * This is a non-clicking source flow: strict item whitelist, no href/url
 * keys, title text scrubbed for handles + URL-like fragments, and independent
 * degradation so a malformed Source window cannot take down the market lanes.
 */
function mapSourceFeed(section: unknown): SourceFeedData | null {
  const parsed = sourceWindowSchema.safeParse(section);
  if (!parsed.success) return null;
  const source: SourceFeedData = {
    title: parsed.data.title,
    badge: parsed.data.badge as MarketLaneBadge,
    items: parsed.data.items,
  };
  const asOfLabel = formatAsOfLabel(parsed.data.asOf);
  if (asOfLabel) source.asOfLabel = asOfLabel;
  return source;
}

function mapReviewedHome(section: unknown): ReviewedHomeData | null {
  const parsed = reviewedHomeSchema.safeParse(section);
  if (!parsed.success) return null;

  const provenance = {
    sourceMode: parsed.data.sourceMode,
    reviewStatus: parsed.data.reviewStatus,
  } as const;
  const series: FocusSeries[] = parsed.data.focusSession.series.map(
    (item) => {
      const baseValue = item.points[0].value;
      const lastValue = item.points.at(-1)!.value;
      return {
        instrumentId: item.instrumentId,
        seriesPacketId: item.seriesPacketId,
        points: item.points,
        baseValue,
        lastValue,
        changeFromBasePct: ((lastValue - baseValue) / baseValue) * 100,
        ...provenance,
      };
    },
  );

  return {
    cells: parsed.data.cells,
    pagePacketId: parsed.data.pagePacketId,
    marketPacketId: parsed.data.marketPacketId,
    asOfJst: parsed.data.asOfJst,
    dataDate: parsed.data.dataDate,
    focusSession: {
      sessionDate: parsed.data.focusSession.sessionDate,
      sessionSlug: parsed.data.focusSession.sessionSlug,
      focusInstruments: parsed.data.focusSession.focusInstruments,
      series,
    },
    provenance,
  };
}

/**
 * Validate and map a terminal feed payload. Returns null when the payload is
 * not exactly what the contract promises — the caller keeps the fixture.
 */
export function mapTerminalFeed(payload: unknown): LiveMarketData | null {
  const parsed = terminalFeedSchema.safeParse(payload);
  if (!parsed.success) return null;
  const {
    schema_version: schemaVersion,
    windows,
    ticker,
    generated_at: generatedAt,
  } = parsed.data;
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
    // B5: RWA reads the delivered lane; an invalid section keeps the fixture.
    mapRwaLane(windows.rwaLane) ?? rwaFixture,
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

  return {
    lanes,
    ticker: tickerItems,
    generatedAt,
    liveRadar: mapLiveRadar(windows.liveRadar),
    scheduledSession: mapScheduledSession(windows.scheduledSession),
    published: mapPublished(windows.published),
    source: mapSourceFeed(windows.source),
    home:
      schemaVersion === TERMINAL_FEED_SCHEMA_V02 ||
      schemaVersion === TERMINAL_FEED_SCHEMA_V03 ||
      schemaVersion === TERMINAL_FEED_SCHEMA_V04
        ? mapReviewedHome(parsed.data.home)
        : null,
    // G43-d: the radar bundle is v0.3-only — v0.1/v0.2 payloads never read it,
    // even if the key happens to be present (schema-version-gated, not
    // key-presence-gated).
    radar:
      schemaVersion === TERMINAL_FEED_SCHEMA_V03 ||
      schemaVersion === TERMINAL_FEED_SCHEMA_V04
        ? mapRadarBundle(parsed.data.radar)
        : null,
    // G43-e (S2): the sessions bundle is v0.3-only, same version-gated
    // (not key-presence-gated) posture as radar above.
    sessions:
      schemaVersion === TERMINAL_FEED_SCHEMA_V03 ||
      schemaVersion === TERMINAL_FEED_SCHEMA_V04
        ? mapSessionsBundle(parsed.data.sessions, {
            allowEditorial: schemaVersion === TERMINAL_FEED_SCHEMA_V04,
            allowPreviousGlobalClose:
              schemaVersion === TERMINAL_FEED_SCHEMA_V04,
          })
        : null,
  };
}

/**
 * 2026-08-23 (田平氏 GO): one bounded retry before the fixture fallback.
 * A single transient Blob fetch failure right after a deploy rendered the
 * fixture (as-of 2026-07-10) and `app/[locale]/page.tsx`'s ISR pinned it for
 * up to 5 minutes — the third time a transient fetch read as "the Terminal
 * stopped / regressed" (8/10, 8/11, 8/23). Only fetch-level failures (thrown
 * error, non-ok status, unreadable body) retry; a payload the mapper rejects
 * is returned as null immediately because it will not change on retry.
 * Two attempts × the per-attempt timeout stay under the route's budget.
 */
export const TERMINAL_FEED_FETCH_ATTEMPTS = 2;
export const TERMINAL_FEED_FETCH_TIMEOUT_MS = 4_000;

/**
 * Server-side fetch of the delivered feed. Returns null (→ fixture fallback)
 * when the env URL is unset, every attempt fails, or the payload is invalid.
 * Next's data cache (revalidate) keeps the last good payload between
 * deliveries, which is the design §3-4 behaviour for delivery outages.
 */
export async function fetchLiveMarketData(): Promise<LiveMarketData | null> {
  const url = process.env[TERMINAL_FEED_ENV_KEY];
  if (!url) return null;
  for (let attempt = 1; attempt <= TERMINAL_FEED_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        next: { revalidate: TERMINAL_FEED_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(TERMINAL_FEED_FETCH_TIMEOUT_MS),
      });
      if (response.ok) return mapTerminalFeed(await response.json());
    } catch {
      // transient — fall through to the next attempt
    }
  }
  return null;
}
