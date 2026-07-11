import { z } from "zod";

import { snowflakeJstIso } from "./evidence.mjs";

export const MANIFEST_FAMILIES = [
  "daily-intel",
  "signal",
  "deep-dive",
  "future-map",
  "mkt12-morning",
  "mkt12-weekend",
  "event-risk-radar",
];

const ALLOWED_SOURCE_ROOTS = [
  "07_DATA/content/drafts/SITIONjp/",
  "08_DOCS/drafts/",
];
const RESERVED_SLUGS = ["today", "series", "archive"];
const STAGE1_FROM = "2026-06-11";
const JST_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/;
const STN_X_URL = /^https:\/\/x\.com\/SITIONjp\/status\/\d+$/;
const SLUG_RULES = {
  "daily-intel":
    /^daily-intel-(\d{4}-\d{2}-\d{2})(-(morning|midday|evening|night))?(-[2-9])?$/,
  signal: /^signal-[a-z0-9-]+?-(\d{4}-\d{2}-\d{2})$/,
  "deep-dive": /^deep-dive-[a-z0-9-]+$/,
  "future-map": /^future-map-[a-z0-9-]+$/,
  "mkt12-morning": /^mkt12-morning-(\d{4}-\d{2}-\d{2})$/,
  "mkt12-weekend": /^mkt12-weekend-(\d{4}-\d{2}-\d{2})$/,
  "event-risk-radar": /^event-risk-radar-w\d{1,2}$/,
};

function pathInAllowedRoot(sourcePath) {
  return (
    ALLOWED_SOURCE_ROOTS.some((root) => sourcePath.startsWith(root)) &&
    !sourcePath.includes("..")
  );
}

export const ManifestRecordSchema = z
  .strictObject({
    postId: z.string().min(1),
    sourcePath: z.string().min(1),
    sourceRef: z
      .string()
      .regex(/^(worktree|content-archive:[0-9a-f]{7,40})$/),
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
    family: z.enum(MANIFEST_FAMILIES),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .refine((slug) => !RESERVED_SLUGS.includes(slug), "reserved slug"),
    titleJa: z.string().min(1),
    titleOriginal: z.string().min(1),
    titleTransform: z.enum(["strip_prefix", "verbatim"]),
    titlePrefix: z.string().min(1).nullable(),
    publishedAtJst: z.string().regex(JST_ISO),
    dataDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    lanes: z.array(z.enum(["macro", "crypto", "rwa"])),
    sourceXUrl: z
      .string()
      .regex(STN_X_URL, "must be an x.com/SITIONjp status URL")
      .nullable(),
    evidenceKind: z.enum(["archive", "frontmatter", "log_verified"]),
    primaryUrl: z.string().url().nullable(),
    archiveCommit: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .nullable(),
    logId: z.string().nullable(),
    logUrl: z
      .string()
      .regex(STN_X_URL, "must be an x.com/SITIONjp status URL")
      .nullable(),
    logPublishedAtUtc: z.string().nullable(),
    logTitle: z.string().nullable(),
    titleMatch: z.enum(["exact", "normalized", "manual"]).nullable(),
    bodySelector: z.enum([
      "exact_marker",
      "decorated_marker",
      "xcopy_marker",
      "full_after_frontmatter",
      "external_file",
    ]),
    bodySourcePath: z.string().nullable(),
    bodySourceSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    publicH2s: z.array(z.string().min(1)),
    internalH2s: z.array(z.string().min(1)),
    h2ClassificationBasis: z
      .enum([
        "external_body",
        "po_parser_boundary",
        "explicit_editorial_review",
      ])
      .nullable(),
    leadDuplicateLine: z.string().min(1).nullable(),
    trailingHashtagLine: z.string().min(1).nullable(),
    manualReviewedBy: z.enum(["codex", "fable5"]).nullable(),
    manualReviewReason: z.string().min(1).nullable(),
    timeBasis: z.enum(["snowflake_url"]).nullable(),
    forbiddenTermHits: z.array(z.string()),
    bodyPatch: z
      .strictObject({
        approvedBy: z.literal("tabira"),
        replacements: z
          .array(
            z.strictObject({
              from: z.string().min(1),
              to: z.string().min(1),
              expectedCount: z.number().int().min(1),
            }),
          )
          .min(1),
      })
      .nullable(),
    include: z.boolean(),
    excludeReason: z.string().min(1).nullable(),
    stage: z.union([z.literal(1), z.literal(2)]).nullable(),
  })
  .superRefine((record, context) => {
    const issue = (message) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message });

    if (!pathInAllowedRoot(record.sourcePath)) {
      issue(
        record.sourcePath.includes("..")
          ? "sourcePath contains .."
          : "sourcePath outside allowed root",
      );
    }
    if (record.bodySourcePath && !pathInAllowedRoot(record.bodySourcePath)) {
      issue("bodySourcePath outside allowed root or contains ..");
    }

    const rule = SLUG_RULES[record.family];
    const slugMatch = record.slug.match(rule);
    if (!slugMatch) {
      issue(`slug does not match family rule: ${record.family}`);
      return;
    }
    const slugDate = slugMatch[1] ?? null;
    const publishedDate = record.publishedAtJst.slice(0, 10);
    if (
      (record.family === "daily-intel" || record.family === "signal") &&
      slugDate !== publishedDate
    ) {
      issue("slug date != publishedAtJst date");
    }
    const isMkt12 =
      record.family === "mkt12-morning" ||
      record.family === "mkt12-weekend";
    if (isMkt12 && (!record.dataDate || slugDate !== record.dataDate)) {
      issue("mkt12 slug date must equal dataDate");
    }
    if (!isMkt12 && record.dataDate !== null) {
      issue("dataDate is only valid on mkt12 families");
    }
    if (new Set(record.lanes).size !== record.lanes.length) {
      issue("lanes contains duplicates");
    }

    const hasH2s = record.publicH2s.length + record.internalH2s.length > 0;
    if (hasH2s && !record.h2ClassificationBasis) {
      issue("records with H2s require h2ClassificationBasis");
    }
    if (!hasH2s && record.h2ClassificationBasis !== null) {
      issue("h2ClassificationBasis is only valid on records with H2s");
    }

    if (record.titleTransform === "strip_prefix") {
      if (!record.titlePrefix) {
        issue("strip_prefix requires titlePrefix");
      } else if (record.titlePrefix + record.titleJa !== record.titleOriginal) {
        issue("titlePrefix concatenation mismatch");
      }
    } else if (record.titleJa !== record.titleOriginal) {
      issue("verbatim requires titleJa === titleOriginal");
    }

    if (record.bodySelector === "external_file") {
      if (!record.bodySourcePath || !record.bodySourceSha256) {
        issue("external_file requires bodySourcePath and bodySourceSha256");
      }
    } else if (record.bodySourcePath || record.bodySourceSha256) {
      issue("bodySourcePath is only valid with external_file");
    }

    if (record.include) {
      if (!record.sourceXUrl) {
        issue("include=true requires sourceXUrl");
      }
      if (
        record.evidenceKind === "archive" &&
        (!record.primaryUrl || !record.archiveCommit)
      ) {
        issue("archive evidence requires primaryUrl and archiveCommit");
      }
      if (
        record.evidenceKind === "frontmatter" &&
        !record.primaryUrl
      ) {
        issue("frontmatter evidence requires primaryUrl");
      }
      if (record.evidenceKind === "log_verified") {
        if (
          !record.logId ||
          !record.logUrl ||
          !record.logPublishedAtUtc ||
          !record.logTitle ||
          !record.titleMatch
        ) {
          issue(
            "log_verified requires logId/logUrl/logPublishedAtUtc/logTitle/titleMatch",
          );
        }
        if (record.logId && record.logId !== record.postId) {
          issue("logId must equal postId");
        }
        if (record.logUrl && record.sourceXUrl !== record.logUrl) {
          issue("sourceXUrl must equal the adopted evidence URL (logUrl)");
        }
      } else if (
        record.primaryUrl &&
        record.sourceXUrl !== record.primaryUrl
      ) {
        issue("sourceXUrl must equal the adopted evidence URL (primaryUrl)");
      }
      if (
        record.titleMatch === "manual" &&
        (!record.manualReviewedBy || !record.manualReviewReason)
      ) {
        issue(
          "titleMatch manual requires manualReviewedBy and manualReviewReason",
        );
      }
      if (record.timeBasis === "snowflake_url") {
        if (record.evidenceKind === "log_verified") {
          issue("timeBasis snowflake_url is not valid for log_verified");
        } else if (
          record.sourceXUrl &&
          snowflakeJstIso(record.sourceXUrl) !== record.publishedAtJst
        ) {
          issue(
            "publishedAtJst must equal the snowflake-derived JST of sourceXUrl",
          );
        }
      }
      if (record.forbiddenTermHits.length > 0 && record.bodyPatch === null) {
        issue("forbidden term hits require an approved bodyPatch or exclusion");
      }
      const expectedStage = publishedDate >= STAGE1_FROM ? 1 : 2;
      if (record.stage !== expectedStage) {
        issue(`stage inconsistent with publishedAtJst (expected ${expectedStage})`);
      }
    } else {
      if (!record.excludeReason) {
        issue("include=false requires excludeReason");
      }
      if (record.stage !== null) {
        issue("include=false requires stage:null");
      }
    }
  });

export function validateManifest(records) {
  const errors = [];
  records.forEach((record, index) => {
    const parsed = ManifestRecordSchema.safeParse(record);
    if (!parsed.success) {
      errors.push(
        `record[${index}] (${record?.postId ?? "?"}): ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
    }
  });

  const uniqueBy = (label, keyFor, subset) => {
    const seen = new Map();
    for (const record of subset) {
      const key = keyFor(record);
      if (seen.has(key)) {
        errors.push(
          `duplicate ${label}: ${key} (${seen.get(key)} / ${record.postId})`,
        );
      }
      seen.set(key, record.postId);
    }
  };
  uniqueBy("postId", (record) => record.postId, records);
  uniqueBy(
    "source",
    (record) => `${record.sourceRef}::${record.sourcePath}`,
    records,
  );
  uniqueBy(
    "slug",
    (record) => record.slug,
    records.filter((record) => record?.include === true),
  );

  const slotFor = (hhmm) => {
    if (hhmm < "11:00") return "morning";
    if (hhmm < "17:00") return "midday";
    if (hhmm < "21:00") return "evening";
    return "night";
  };
  const dailies = records.filter(
    (record) => record?.include === true && record.family === "daily-intel",
  );
  const byDate = new Map();
  for (const record of dailies) {
    const date = record.publishedAtJst.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), record]);
  }
  for (const [date, group] of byDate) {
    if (group.length === 1) {
      const expected = `daily-intel-${date}`;
      if (group[0].slug !== expected) {
        errors.push(
          `daily-intel slug derivation mismatch: ${group[0].postId} expected ${expected}`,
        );
      }
      continue;
    }
    const bySlot = new Map();
    for (const record of group.toSorted((left, right) =>
      (left.publishedAtJst + left.postId).localeCompare(
        right.publishedAtJst + right.postId,
      ),
    )) {
      const slot = slotFor(record.publishedAtJst.slice(11, 16));
      const siblings = bySlot.get(slot) ?? [];
      const expected = `daily-intel-${date}-${slot}${
        siblings.length > 0 ? `-${siblings.length + 1}` : ""
      }`;
      if (record.slug !== expected) {
        errors.push(
          `daily-intel slug derivation mismatch: ${record.postId} expected ${expected}, got ${record.slug}`,
        );
      }
      bySlot.set(slot, [...siblings, record]);
    }
  }

  return { ok: errors.length === 0, errors };
}
