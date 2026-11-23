import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

export const ARTICLE_FAMILIES = [
  "daily-intel",
  "signal",
  "deep-dive",
  "future-map",
  "mkt12-morning",
  "mkt12-weekend",
  "event-risk-radar",
  "weekly-brief",
  "session",
  "future-atlas",
  "flash",
  "landmark",
  "restart-map",
  "cycle-forecast",
] as const;
export type ArticleFamily = (typeof ARTICLE_FAMILIES)[number];

export const SERIES_SLUGS = [
  "daily-intel",
  "signal",
  "deep-dive",
  "future-map",
  "mkt12-morning",
  "mkt12-weekend",
  "event-risk-radar",
  "weekly-brief",
  "flash",
  "landmark",
  "restart-map",
  "cycle-forecast",
] as const;
export type SeriesSlug = (typeof SERIES_SLUGS)[number];

export const ARTICLE_LANES = ["macro", "crypto", "rwa"] as const;
export type ArticleLane = (typeof ARTICLE_LANES)[number];

const RESERVED_ARTICLE_SLUGS = ["today", "series", "archive"];
const JST_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/;

// 2026-11-23 (田平氏承認): サイクル予報のカードの指標の表 (本採用の指標を 1 行ずつ)。
// 形は発行側 (sub-repo lineup.py) と同じ: 1〜12 行・label 40・value 60 (UTF-16)・前後の空白と改行なし。
// 絵文字は送らない — 天気の言葉から ☀ ⛅ ☔ ― と読み上げの言葉をサイトが付ける
export const FORECAST_ROW_SCOPES = ["btc", "altseason"] as const;
export const FORECAST_ROW_WEATHERS = ["sunny", "cloudy", "rain", "missing"] as const;

function forecastCell(max: number) {
  return z
    .string()
    .min(1)
    .max(max)
    .refine((s) => s === s.trim() && !/[\r\n]/.test(s), "must be one trimmed line");
}

export const ForecastRowsSchema = z
  .array(
    z.strictObject({
      scope: z.enum(FORECAST_ROW_SCOPES),
      weather: z.enum(FORECAST_ROW_WEATHERS),
      label: forecastCell(40),
      value: forecastCell(60),
    }),
  )
  .min(1)
  .max(12);

export type ForecastRow = z.infer<typeof ForecastRowsSchema>[number];

export const ArticleMetaSchema = z
  .strictObject({
    articleId: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .refine(
        (slug) => !RESERVED_ARTICLE_SLUGS.includes(slug),
        "articleId collides with a reserved route segment",
      ),
    family: z.enum(ARTICLE_FAMILIES),
    titleJa: z.string().min(1),
    titleEn: z.string().min(1).optional(),
    excerptJa: z.string().min(1).optional(),
    publishedAtJst: z.string().regex(JST_ISO),
    publishedLabel: z.string().min(1),
    dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    lanes: z.array(z.enum(ARTICLE_LANES)).default([]),
    regimeNoteJa: z.string().min(1).optional(),
    // INFLOW-G2 T1a: 検証済みサムネの Blob URL (feed 由来・検証は
    // thumbnail-verification.ts が担い、ここには通過済みの値だけが入る)
    thumbnailUrl: z.string().url().startsWith("https://").optional(),
    sourceXUrl: z
      .string()
      .regex(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/)
      .optional(),
    radarTopicId: z.string().min(1).optional(),
    // 2026-11-23 (田平氏 GO・案 1): 発行側の検索に出すかの印 (lib/articles/search-visibility.ts)。
    // feed の値は mapInflowArticle が真偽値だけに絞ってから渡す
    searchIndex: z.boolean().optional(),
    // 2026-11-23 (田平氏 GO・案 A): サイクル予報の号の天気の 1 行 (トップページの左の列のカード)。
    // feed の値は mapInflowArticle が cycle-forecast・1 行・120 字以内に絞ってから渡す
    forecastNoteJa: z.string().min(1).max(120).optional(),
    // 2026-11-23 (田平氏承認): サイクル予報の号の指標の表。feed の値は mapInflowArticle が
    // ForecastRowsSchema に合うときだけ渡す (1 行でも合わなければ表ごと捨てる)
    forecastRowsJa: ForecastRowsSchema.optional(),
  })
  .superRefine((meta, context) => {
    if (
      (meta.family === "mkt12-morning" ||
        meta.family === "mkt12-weekend") &&
      !meta.dataDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "mkt12 articles require dataDate",
      });
    }
    if (meta.forecastRowsJa && meta.family !== "cycle-forecast") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "forecastRowsJa is only valid on cycle-forecast",
      });
    }
    if (meta.forecastNoteJa && meta.family !== "cycle-forecast") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "forecastNoteJa is only valid on cycle-forecast",
      });
    }
    if (meta.regimeNoteJa && meta.family !== "mkt12-morning") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "regimeNoteJa is only valid on mkt12-morning",
      });
    }
  });

export type ParsedArticleMeta = z.infer<typeof ArticleMetaSchema>;
export type ArticleMeta = ParsedArticleMeta & { href: string };

const DEFAULT_CONTENT_DIR = path.join(process.cwd(), "content", "articles");

export interface ArticleLoadOptions {
  contentDir?: string;
}

export function getAllArticles(
  options: ArticleLoadOptions = {},
): ArticleMeta[] {
  const contentDir = options.contentDir ?? DEFAULT_CONTENT_DIR;
  if (!fs.existsSync(contentDir)) {
    return [];
  }

  return fs
    .readdirSync(contentDir)
    .filter((directory) =>
      fs.existsSync(path.join(contentDir, directory, "meta.json")),
    )
    .map((directory) => {
      const meta = ArticleMetaSchema.parse(
        JSON.parse(
          fs.readFileSync(
            path.join(contentDir, directory, "meta.json"),
            "utf8",
          ),
        ),
      );
      if (meta.articleId !== directory) {
        throw new Error(`articleId must equal directory name: ${directory}`);
      }
      return { ...meta, href: `/articles/${meta.articleId}` };
    })
    .sort((left, right) =>
      right.publishedAtJst.localeCompare(left.publishedAtJst),
    );
}

export function getArticleBySlug(
  slug: string,
  options: ArticleLoadOptions = {},
): ArticleMeta {
  const article = getAllArticles(options).find(
    (candidate) => candidate.articleId === slug,
  );
  if (!article) {
    throw new Error(`article not found: ${slug}`);
  }
  return article;
}

export function getArticleBody(
  slug: string,
  locale: "ja" | "en",
  options: ArticleLoadOptions = {},
): string {
  const contentDir = options.contentDir ?? DEFAULT_CONTENT_DIR;
  const localizedPath = path.join(contentDir, slug, `${locale}.md`);
  if (fs.existsSync(localizedPath)) {
    return fs.readFileSync(localizedPath, "utf8");
  }
  return fs.readFileSync(path.join(contentDir, slug, "ja.md"), "utf8");
}
