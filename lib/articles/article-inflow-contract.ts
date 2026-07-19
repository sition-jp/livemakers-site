import { createHash } from "node:crypto";
import { z } from "zod";

import {
  ARTICLE_FAMILIES,
  ArticleMetaSchema,
  type ArticleMeta,
} from "@/lib/articles/article-model";

export const ARTICLE_INFLOW_SCHEMA_VERSION = "livemakers_article_inflow_feed_v0";
const CHECKSUM = /^[0-9a-f]{64}$/;
const RESERVED_SLUGS = new Set(["today", "series", "archive"]);

const ArticleInflowItemSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/).refine((slug) => !RESERVED_SLUGS.has(slug)),
    title: z.string().min(1),
    family: z.enum(ARTICLE_FAMILIES),
    source_x_url: z.string().regex(/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/),
    published_at: z.string().datetime({ offset: true }),
    body: z.string().min(1),
    body_checksum: z.string().regex(CHECKSUM),
    validator: z.object({
      verdict: z.literal("green"),
      vocabulary_version: z.string().min(1),
    }).passthrough(),
  })
  .passthrough();

const ArticleInflowFeedSchema = z
  .object({
    schema_version: z.literal(ARTICLE_INFLOW_SCHEMA_VERSION),
    environment: z.enum(["staging", "production"]),
    generated_at: z.string().datetime({ offset: true }),
    feed_checksum: z.string().regex(/^[0-9a-f]{16}$/),
    articles: z.array(ArticleInflowItemSchema),
  })
  .passthrough()
  .superRefine((feed, context) => {
    const slugs = new Set<string>();
    feed.articles.forEach((article, index) => {
      if (slugs.has(article.slug)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["articles", index, "slug"],
          message: "duplicate slug",
        });
      }
      slugs.add(article.slug);
      if (calculateArticleBodyChecksum(article.body) !== article.body_checksum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["articles", index, "body_checksum"],
          message: "body checksum mismatch",
        });
      }
    });
  });

export type ArticleInflowFeed = z.infer<typeof ArticleInflowFeedSchema>;
export type ArticleInflowPreviewArticle = ArticleMeta & {
  source: "repository" | "inflow";
  declaredBodyChecksum?: string;
  inflowBody?: string;
};
export interface ArticleInflowPreviewCatalog {
  articles: ArticleInflowPreviewArticle[];
  feedChecksum: string | null;
}

export function calculateArticleBodyChecksum(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function parseArticleInflowFeed(payload: unknown): ArticleInflowFeed | null {
  const result = ArticleInflowFeedSchema.safeParse(payload);
  return result.success ? result.data : null;
}

function toJstParts(value: string) {
  const jst = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  const date = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
  const time = `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
  return { date, time, iso: `${date}T${time}:${pad(jst.getUTCSeconds())}+09:00` };
}

function mapInflowArticle(article: ArticleInflowFeed["articles"][number]): ArticleInflowPreviewArticle {
  const jst = toJstParts(article.published_at);
  const parsed = ArticleMetaSchema.parse({
    articleId: article.slug,
    family: article.family,
    titleJa: article.title,
    publishedAtJst: jst.iso,
    publishedLabel: `${jst.date.slice(5)} ${jst.time} 公開`,
    dataDate: article.family.startsWith("mkt12-") ? jst.date : undefined,
    lanes: [],
    sourceXUrl: article.source_x_url,
  });
  return {
    ...parsed,
    href: `/article-inflow-preview/articles/${article.slug}`,
    source: "inflow",
    declaredBodyChecksum: article.body_checksum,
    inflowBody: article.body,
  };
}

export function buildArticleInflowPreviewCatalog(
  repositoryArticles: ArticleMeta[],
  feed: ArticleInflowFeed | null,
): ArticleInflowPreviewCatalog {
  const repositorySlugs = new Set(repositoryArticles.map((article) => article.articleId));
  const repository = repositoryArticles.map((article) => ({
    ...article,
    href: `/article-inflow-preview/articles/${article.articleId}`,
    source: "repository" as const,
  }));
  const inflow = (feed?.articles ?? [])
    .filter((article) => !repositorySlugs.has(article.slug))
    .map(mapInflowArticle);
  return {
    articles: [...repository, ...inflow].sort((left, right) =>
      right.publishedAtJst.localeCompare(left.publishedAtJst),
    ),
    feedChecksum: feed?.feed_checksum ?? null,
  };
}
