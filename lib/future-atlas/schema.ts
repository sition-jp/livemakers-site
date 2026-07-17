import { z } from "zod";

export const ATLAS_KINDS = ["vision", "structural_report", "forecast"] as const;
export const CONFIDENCE_BANDS = ["leaning", "base_case", "high_conviction"] as const;
export const RESOLUTION_STATUSES = ["true", "false", "indeterminate", "void"] as const;

const JST_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\+09:00$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const isRealJstTimestamp = (ts: string) => {
  if (!isRealDate(ts.slice(0, 10))) return false;
  const [hh, mm, ss] = ts.slice(11).replace("+09:00", "").split(":").map(Number);
  return hh <= 23 && mm <= 59 && (ss === undefined || ss <= 59);
};

const zIsoDate = z.string().regex(ISO_DATE).refine(isRealDate, { message: "not a real calendar date" });
const zJstTimestamp = z.string().regex(JST_TIMESTAMP).refine(isRealJstTimestamp, { message: "not a real JST timestamp" });
const jstDate = (ts: string) => ts.slice(0, 10);

const addYearsClamped = (isoDate: string, years: number) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${y + years}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const AtlasConfigSchema = z.strictObject({
  schemaVersion: z.literal(1),
  surfacePublished: z.boolean(),
});

export const MANIFEST_MUTABLE_FIELD_SCHEMAS = {
  themes: z.array(z.string().min(1)).min(1),
  atlasPlacement: z.number().int().min(0),
  relatedArticleIds: z.array(z.string().regex(/^[a-z0-9-]+$/)),
  authorDisplay: z.string().min(1),
  authorshipMode: z.enum(["human_written", "ai_draft_human_edited"]),
} as const;

export const ManifestEntrySchema = z.strictObject({
  articleId: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(ATLAS_KINDS),
  themes: MANIFEST_MUTABLE_FIELD_SCHEMAS.themes,
  atlasPlacement: MANIFEST_MUTABLE_FIELD_SCHEMAS.atlasPlacement,
  relatedArticleIds: MANIFEST_MUTABLE_FIELD_SCHEMAS.relatedArticleIds.default([]),
  authorDisplay: MANIFEST_MUTABLE_FIELD_SCHEMAS.authorDisplay,
  authorshipMode: MANIFEST_MUTABLE_FIELD_SCHEMAS.authorshipMode,
}).superRefine((entry, ctx) => {
  if (entry.kind === "vision" && entry.authorshipMode !== "human_written") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "vision requires human_written (G46 guard #20)" });
  }
});

export const ManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  themes: z.array(z.strictObject({
    key: z.string().regex(/^[a-z0-9-]+$/),
    titleJa: z.string().min(1),
    titleEn: z.string().min(1).optional(),
    order: z.number().int().min(0),
  })),
  entries: z.array(ManifestEntrySchema),
}).superRefine((manifest, ctx) => {
  const ids = manifest.entries.map((entry) => entry.articleId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate articleId in manifest" });
  }

  const themeKeyList = manifest.themes.map((theme) => theme.key);
  if (new Set(themeKeyList).size !== themeKeyList.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate theme key" });
  }

  const themeKeys = new Set(themeKeyList);
  for (const entry of manifest.entries) {
    for (const theme of entry.themes) {
      if (!themeKeys.has(theme)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown theme key: ${theme}` });
      }
    }
  }
});

export const ContractSchema = z.strictObject({
  schemaVersion: z.literal(1),
  forecastId: z.string().regex(/^fc-[a-z0-9-]+$/),
  claim: z.string().min(1),
  evidenceCutoff: zIsoDate,
  publishedAtJst: zJstTimestamp,
  dueAt: zIsoDate,
  resolutionCriteria: z.string().min(1),
  resolutionSources: z.array(z.string().min(1)).min(1),
  confidence: z.enum(CONFIDENCE_BANDS),
  articleId: z.string().regex(/^[a-z0-9-]+$/),
  authorId: z.string().min(1),
}).superRefine((contract, ctx) => {
  const published = jstDate(contract.publishedAtJst);
  if (!(contract.dueAt > published)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "dueAt must be after publishedAtJst (guard #9)" });
  }
  if (contract.dueAt > addYearsClamped(published, 3)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "dueAt exceeds 3 years — write as vision (guard #10)" });
  }
  if (contract.evidenceCutoff > published) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "evidenceCutoff must be <= publishedAtJst (guard #15)" });
  }
});

export const SecondReviewSchema = z.strictObject({
  reviewer: z.string().min(1),
  reviewedAt: zIsoDate,
  reviewDecision: z.enum(["agree", "disagree"]),
  reviewNote: z.string().min(1),
});

const eventBase = {
  eventId: z.string().regex(/^ev-[a-z0-9-]+$/),
  date: zIsoDate,
  note: z.string().optional(),
  materials: z.array(z.string().min(1)).default([]),
  articleId: z.string().regex(/^[a-z0-9-]+$/).optional(),
};

export const ForecastEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("update"), forecastId: z.string(), ...eventBase,
    note: z.string().min(1), supersededByForecastId: z.string().optional() }),
  z.strictObject({ type: z.literal("evidence_added"), forecastId: z.string(), ...eventBase }),
  z.strictObject({ type: z.literal("endorsement_withdrawn"), forecastId: z.string(), ...eventBase,
    note: z.string().min(1) }),
  z.strictObject({ type: z.literal("resolution"), forecastId: z.string(), ...eventBase,
    resolutionStatus: z.enum(RESOLUTION_STATUSES), decidedBy: z.string().min(1),
    secondReview: SecondReviewSchema.optional() }),
  z.strictObject({ type: z.literal("resolution_correction"), forecastId: z.string(), ...eventBase,
    materials: z.array(z.string().min(1)).min(1),
    supersedesEventId: z.string().min(1), resolutionStatus: z.enum(RESOLUTION_STATUSES),
    reason: z.string().min(1), correctionArticleId: z.string().min(1),
    decidedBy: z.string().min(1), secondReview: SecondReviewSchema, correctedAt: zIsoDate }),
  z.strictObject({ type: z.literal("metadata_correction"), ...eventBase,
    articleId: z.string().regex(/^[a-z0-9-]+$/), forecastId: z.string().optional(),
    field: z.enum(["themes", "atlasPlacement", "relatedArticleIds", "authorDisplay", "authorshipMode"]),
    before: z.unknown(), after: z.unknown(), reason: z.string().min(1) }),
]).superRefine((event, ctx) => {
  if (event.type === "resolution") {
    const binary = event.resolutionStatus === "true" || event.resolutionStatus === "false";
    if (binary && (!event.articleId || event.materials.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "true/false requires articleId + materials (guard #8)" });
    }
    if (!binary && (!event.note || !event.secondReview || event.materials.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "indeterminate/void requires reason + materials + secondReview (guard #8)" });
    }
  }
  if ((event.type === "resolution" || event.type === "resolution_correction")
      && event.secondReview && event.secondReview.reviewer === event.decidedBy) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "secondReview.reviewer must differ from decidedBy (guard #8)" });
  }
  if (event.type === "metadata_correction") {
    const valueSchema = MANIFEST_MUTABLE_FIELD_SCHEMAS[event.field];
    for (const [label, value] of [["before", event.before], ["after", event.after]] as const) {
      if (!valueSchema.safeParse(value).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `metadata_correction ${label} must match the ${event.field} value type (guard #17)`,
        });
      }
    }
  }
});

export const loadContracts = (contracts: unknown[]): ForecastContract[] => {
  const parsed = contracts.map((contract) => ContractSchema.parse(contract));
  const forecastIds = parsed.map((contract) => contract.forecastId);
  if (new Set(forecastIds).size !== forecastIds.length) {
    throw new Error("duplicate forecastId across contracts (guard #1)");
  }
  return parsed;
};

export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;
export type ForecastContract = z.infer<typeof ContractSchema>;
export type ForecastEvent = z.infer<typeof ForecastEventSchema>;
