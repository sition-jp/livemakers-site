import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import {
  CHARTABLE_INSTRUMENTS,
  type InstrumentId,
} from "@/lib/home/instruments";
import {
  READER_SESSIONS,
  getSessionBySlug,
  type ReaderSessionSlug,
} from "./session-registry";

export const SESSION_URL_PREFIX = "/sessions/";

const SESSION_SLUGS = [
  "asia-open",
  "europe-bridge",
  "ny-open",
  "global-close",
] as const;
const slugEnum = z.enum(SESSION_SLUGS);
const JST_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/;
const EDITORIAL_ANCHOR_BY_SLUG = {
  "asia-open": "05:03",
  "europe-bridge": "12:03",
  "ny-open": "18:03",
  "global-close": "23:03",
} as const;
const EDITORIAL_URL_OR_HANDLE_PATTERN =
  /(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/\S*)?|(?<![A-Za-z0-9_@.])@[A-Za-z0-9_]{2,30}\b/i;
const EDITORIAL_RANK_PATTERN =
  /\brank\s*[ABC]\b|ランク\s*[ABC]|[ABC]\s*層/i;
const EDITORIAL_ENGAGEMENT_PATTERN =
  /いいね\s*[\d,]+|[\d,]+\s*likes|RT\s*[\d,]+|リポスト\s*[\d,]+|エンゲージメント/i;
const EDITORIAL_FIRST_PERSON_PATTERN =
  /私|筆者|我々|われわれ|\b(?:I|we|my|our|me)\b/i;
const EDITORIAL_CERTAINTY_PATTERN =
  /確実|間違いなく|断定(?:した|する)|絶対|必ず|保証(?:する|される)|\b(?:definitely|certainly|surely)\b|\bguarantee(?:d|s|ing)?\b|\bis certain to\b/i;
const EDITORIAL_CONSPIRACY_HYPE_PATTERN =
  /陰謀|黒幕|隠蔽|仕組んだ|劇的|衝撃的|\bconspir(?:acy|atorial)\b|\bmastermind\b/i;

export function sessionEditorialTextViolations(value: string): string[] {
  return [
    ["url_or_handle", EDITORIAL_URL_OR_HANDLE_PATTERN],
    ["rank", EDITORIAL_RANK_PATTERN],
    ["engagement", EDITORIAL_ENGAGEMENT_PATTERN],
    ["first_person", EDITORIAL_FIRST_PERSON_PATTERN],
    ["unsupported_certainty", EDITORIAL_CERTAINTY_PATTERN],
    ["conspiracy_hype", EDITORIAL_CONSPIRACY_HYPE_PATTERN],
  ]
    .filter(([, pattern]) => (pattern as RegExp).test(value))
    .map(([name]) => name as string);
}

const SessionEditorialItemSchema = z
  .object({
    headline: z.string().trim().min(1).max(80),
    note: z.string().trim().min(1).max(200).optional(),
    sourceUrl: z
      .string()
      .url()
      .refine((value) => value.startsWith("https://"), "sourceUrl must be HTTPS"),
  })
  .strict();

export const SessionEditorialSchema = z
  .object({
    digestId: z.string().regex(/^dig_[a-zA-Z0-9_-]+$/),
    crawlAnchorJst: z.string().regex(JST_ISO),
    writtenAtJst: z.string().regex(JST_ISO),
    lead: z.string().trim().min(1).max(400),
    items: z.array(SessionEditorialItemSchema),
    watch: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
  })
  .strict()
  .superRefine((editorial, context) => {
    if (editorial.writtenAtJst <= editorial.crawlAnchorJst) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "writtenAtJst must be later than crawlAnchorJst",
        path: ["writtenAtJst"],
      });
    }
    const textFields: Array<{ value: string; path: (string | number)[] }> = [
      { value: editorial.lead, path: ["lead"] },
      ...editorial.items.flatMap((item, index) => [
        { value: item.headline, path: ["items", index, "headline"] },
        ...(item.note
          ? [{ value: item.note, path: ["items", index, "note"] }]
          : []),
      ]),
      ...editorial.watch.map((value, index) => ({
        value,
        path: ["watch", index],
      })),
    ];
    for (const field of textFields) {
      if (sessionEditorialTextViolations(field.value).length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "editorial text violates public-purity contract",
          path: field.path,
        });
      }
    }
  });

export type SessionEditorial = z.infer<typeof SessionEditorialSchema>;

export const SessionMetaSchema = z
  .strictObject({
    sessionId: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}-(asia-open|europe-bridge|ny-open|global-close)$/,
      ),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sessionSlug: slugEnum,
    liveStatus: z.enum(["scheduled", "live", "closed"]),
    articleStatus: z.enum(["pending", "published"]),
    currentUrl: z.string().regex(/^\/sessions\/[a-z0-9-]+$/),
    canonicalArticleUrl: z.string().nullable(),
    publishedAt: z.string().regex(JST_ISO).nullable(),
    publishLogId: z.null(),
    packetId: z.string().min(1),
    asOfJst: z.string().regex(JST_ISO),
    focusInstruments: z.array(z.string()),
    titleJa: z.string().min(1),
    bullets: z.array(z.string().min(1)).min(1),
    editorial: SessionEditorialSchema.optional(),
    // 2026-08-23 田平氏 GO (spec 2026-08-23-digest-only-session-design §2):
    // "absent" = 市場観測 (home observer preflight) が RED で数値スナップ
    // ショットが無く、読み解き digest だけで組んだセッション。省略 = green。
    // absent は editorial 必須 (下の superRefine)。live ↔ home.focusSession の
    // 照合 (build-home-props) からは外す。
    observationStatus: z.enum(["green", "absent"]).optional(),
  })
  .superRefine((meta, context) => {
    if (meta.observationStatus === "absent" && !meta.editorial) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "observationStatus absent requires editorial",
        path: ["observationStatus"],
      });
    }
    if (meta.currentUrl !== `${SESSION_URL_PREFIX}${meta.sessionId}`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "currentUrl must be /sessions/<sessionId>",
      });
    }
    if (
      !meta.sessionId.startsWith(`${meta.date}-`) ||
      !meta.sessionId.endsWith(meta.sessionSlug)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sessionId must equal <date>-<sessionSlug>",
      });
    }
    if (
      meta.editorial &&
      meta.editorial.crawlAnchorJst !==
        `${meta.date}T${EDITORIAL_ANCHOR_BY_SLUG[meta.sessionSlug]}:00+09:00`
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "editorial crawlAnchorJst must match date and session slug",
        path: ["editorial", "crawlAnchorJst"],
      });
    }
    if (
      meta.articleStatus === "published" &&
      meta.liveStatus !== "closed"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "published session must have liveStatus=closed",
      });
    }
    if (meta.articleStatus === "published") {
      if (meta.canonicalArticleUrl !== meta.currentUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "canonicalArticleUrl must equal currentUrl for published sessions",
        });
      }
      if (!meta.publishedAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "published session requires publishedAt",
        });
      }
    } else {
      if (meta.canonicalArticleUrl !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "pending session must keep canonicalArticleUrl null",
        });
      }
      if (meta.publishedAt !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "pending session must keep publishedAt null",
        });
      }
    }
  });

export type SessionRecordMeta = z.infer<typeof SessionMetaSchema>;

/** `2026-08-08T23:44:59+09:00` -> `2026-08-08 23:44 JST` (読者向け表示).
 *
 * schema (`JST_ISO`) が `+09:00` を強制するので、日付・時刻はそのまま JST。
 * Date を経由しないのは、実行環境の TZ で日付がずれるのを避けるため。
 * 想定外の形は整形せず原文を返す — 黙って誤った時刻を見せない。
 */
export function formatSessionTimestamp(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const match = value.match(JST_ISO);
  if (!match) {
    return value;
  }
  return `${value.slice(0, 10)} ${value.slice(11, 16)} JST`;
}

export interface SessionRecord
  extends Omit<SessionRecordMeta, "focusInstruments"> {
  focusInstruments: InstrumentId[];
  focusFallbackApplied: boolean;
  bodyJa: string | null;
  /**
   * G43-e (fix round 2 / I-2): true when this record's sessionId exists in
   * the repo's content/sessions/ directory — i.e. generateStaticParams
   * (app/[locale]/sessions/[slug]/page.tsx) will materialize a route for
   * `currentUrl`, so linking to it can never dead-end in a 404. Repo reads
   * (getAllSessionRecords below) always set this true. A feed sessions
   * bundle record (site-first live-session consumer) may or may not be
   * materialized — see lib/home/build-home-props.ts's mergeSessionRecords /
   * toSessionRecord, which derive it from the same repo-dedup check that
   * decides whether the feed record wins over a same-sessionId repo row.
   * Optional so pre-existing hand-built test fixtures keep compiling;
   * consumers treat a missing value as materialized (`!== false`) — the only
   * construction site that can produce `false` is the feed-lift path.
   */
  hasMaterializedRoute?: boolean;
}

export function normalizeFocusInstruments(
  declared: string[],
  slug: ReaderSessionSlug,
): { instruments: InstrumentId[]; fallbackApplied: boolean } {
  const valid = [...new Set(declared)].filter(
    (instrumentId): instrumentId is InstrumentId =>
      (CHARTABLE_INSTRUMENTS as readonly string[]).includes(instrumentId),
  );

  if (valid.length >= 2 && valid.length <= 3) {
    return { instruments: valid, fallbackApplied: false };
  }

  return {
    instruments: [...getSessionBySlug(slug).defaultFocusInstruments],
    fallbackApplied: true,
  };
}

/** Lift a validated sidecar/feed meta object into the shared render shape. */
export function toSessionRecord(
  meta: SessionRecordMeta,
  options: { bodyJa?: string | null; hasMaterializedRoute?: boolean } = {},
): SessionRecord {
  const focus = normalizeFocusInstruments(
    meta.focusInstruments,
    meta.sessionSlug,
  );
  return {
    ...meta,
    focusInstruments: focus.instruments,
    focusFallbackApplied: focus.fallbackApplied,
    bodyJa: options.bodyJa ?? null,
    hasMaterializedRoute: options.hasMaterializedRoute ?? false,
  };
}

const CONTENT_DIR = path.join(process.cwd(), "content", "sessions");

export function parseSessionMeta(raw: unknown): SessionRecordMeta {
  return SessionMetaSchema.parse(raw);
}

export function getAllSessionRecords(): SessionRecord[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    return [];
  }

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((directory) =>
      fs.existsSync(path.join(CONTENT_DIR, directory, "meta.json")),
    )
    .map((directory) => {
      const directoryPath = path.join(CONTENT_DIR, directory);
      const meta = parseSessionMeta(
        JSON.parse(
          fs.readFileSync(path.join(directoryPath, "meta.json"), "utf8"),
        ),
      );
      const bodyPath = path.join(directoryPath, "ja.md");
      const bodyJa = fs.existsSync(bodyPath)
        ? fs.readFileSync(bodyPath, "utf8")
        : null;
      if (meta.articleStatus === "published" && !bodyJa) {
        throw new Error(
          `published session requires ja.md body: ${meta.sessionId}`,
        );
      }
      return toSessionRecord(meta, {
        bodyJa,
        hasMaterializedRoute: true,
      });
    })
    .sort((left, right) => right.asOfJst.localeCompare(left.asOfJst));
}

export function getSessionRecord(sessionId: string): SessionRecord {
  const record = findSessionRecord(sessionId);
  if (!record) {
    throw new Error(`session not found: ${sessionId}`);
  }
  return record;
}

/** Missing is nullable; malformed repo content still throws fail-closed. */
export function findSessionRecord(sessionId: string): SessionRecord | null {
  return (
    getAllSessionRecords().find(
      (candidate) => candidate.sessionId === sessionId,
    ) ?? null
  );
}

export function getTodaySchedule(
  today: string,
  live: SessionRecord | null,
  records: SessionRecord[] = getAllSessionRecords(),
) {
  return READER_SESSIONS.map((definition) => ({
    def: definition,
    isCurrent: live?.sessionSlug === definition.slug && live.date === today,
    // 2026-08-23 田平氏 GO (spec 2026-08-23-terminal-switching-ux-design §C):
    // 「前回を読む →」= そのスロットで最新の closed レコード。crystallize 前の
    // feed 由来 closed (articleStatus=pending) も対象 — 切替中の間に「いま
    // 終わったセッション」へ飛べる。feed レコードは feed に居る限り同 URL を
    // resolveSessionPageRecord が描くので 404 しない。live は対象外。
    previous: records.find(
      (record) =>
        record.sessionSlug === definition.slug &&
        record.liveStatus === "closed",
    ),
  }));
}

export function getDaySessionNav(sessionId: string): {
  prev: SessionRecord | null;
  next: SessionRecord | null;
} {
  const all = getAllSessionRecords();
  const current = all.find((record) => record.sessionId === sessionId);
  if (!current) {
    return { prev: null, next: null };
  }
  const order = READER_SESSIONS.map((definition) => definition.slug);
  const sameDay = all
    .filter((record) => record.date === current.date)
    .sort(
      (left, right) =>
        order.indexOf(left.sessionSlug) - order.indexOf(right.sessionSlug),
    );
  const index = sameDay.findIndex((record) => record.sessionId === sessionId);
  return {
    prev: index > 0 ? sameDay[index - 1] : null,
    next: index >= 0 && index < sameDay.length - 1 ? sameDay[index + 1] : null,
  };
}
