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
] as const;
export type SeriesSlug = (typeof SERIES_SLUGS)[number];

export const ARTICLE_LANES = ["macro", "crypto", "rwa"] as const;
export type ArticleLane = (typeof ARTICLE_LANES)[number];

const RESERVED_ARTICLE_SLUGS = ["today", "series", "archive"];
const JST_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/;

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
    sourceXUrl: z
      .string()
      .regex(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/)
      .optional(),
    radarTopicId: z.string().min(1).optional(),
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
    if (meta.regimeNoteJa && meta.family !== "mkt12-morning") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "regimeNoteJa is only valid on mkt12-morning",
      });
    }
  });

export type ParsedArticleMeta = z.infer<typeof ArticleMetaSchema>;
export type ArticleMeta = ParsedArticleMeta & { href: string };

const CONTENT_DIR = path.join(process.cwd(), "content", "articles");

export function getAllArticles(): ArticleMeta[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    return [];
  }

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((directory) =>
      fs.existsSync(path.join(CONTENT_DIR, directory, "meta.json")),
    )
    .map((directory) => {
      const meta = ArticleMetaSchema.parse(
        JSON.parse(
          fs.readFileSync(
            path.join(CONTENT_DIR, directory, "meta.json"),
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

export function getArticleBySlug(slug: string): ArticleMeta {
  const article = getAllArticles().find(
    (candidate) => candidate.articleId === slug,
  );
  if (!article) {
    throw new Error(`article not found: ${slug}`);
  }
  return article;
}

export function getArticleBody(slug: string, locale: "ja" | "en"): string {
  const localizedPath = path.join(CONTENT_DIR, slug, `${locale}.md`);
  if (fs.existsSync(localizedPath)) {
    return fs.readFileSync(localizedPath, "utf8");
  }
  return fs.readFileSync(path.join(CONTENT_DIR, slug, "ja.md"), "utf8");
}
