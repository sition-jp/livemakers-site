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
  })
  .superRefine((meta, context) => {
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

export interface SessionRecord
  extends Omit<SessionRecordMeta, "focusInstruments"> {
  focusInstruments: InstrumentId[];
  focusFallbackApplied: boolean;
  bodyJa: string | null;
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
      const focus = normalizeFocusInstruments(
        meta.focusInstruments,
        meta.sessionSlug,
      );
      return {
        ...meta,
        focusInstruments: focus.instruments,
        focusFallbackApplied: focus.fallbackApplied,
        bodyJa,
      };
    })
    .sort((left, right) => right.asOfJst.localeCompare(left.asOfJst));
}

export function getSessionRecord(sessionId: string): SessionRecord {
  const record = getAllSessionRecords().find(
    (candidate) => candidate.sessionId === sessionId,
  );
  if (!record) {
    throw new Error(`session not found: ${sessionId}`);
  }
  return record;
}

export function getTodaySchedule(
  today: string,
  live: SessionRecord | null,
  records: SessionRecord[] = getAllSessionRecords(),
) {
  return READER_SESSIONS.map((definition) => ({
    def: definition,
    isCurrent: live?.sessionSlug === definition.slug && live.date === today,
    previous: records.find(
      (record) =>
        record.sessionSlug === definition.slug &&
        record.articleStatus === "published",
    ),
  }));
}
