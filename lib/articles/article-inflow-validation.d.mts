export const ARTICLE_INFLOW_SCHEMA_VERSION: "livemakers_article_inflow_feed_v0";

export type ArticleInflowFamily =
  | "daily-intel"
  | "signal"
  | "deep-dive"
  | "future-map"
  | "mkt12-morning"
  | "mkt12-weekend"
  | "event-risk-radar"
  | "weekly-brief"
  | "session";

export interface ArticleInflowItem {
  slug: string;
  title: string;
  family: ArticleInflowFamily;
  source_x_url: string;
  published_at: string;
  body: string;
  body_checksum: string;
  validator: {
    verdict: "green";
    vocabulary_version: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ArticleInflowFeed {
  schema_version: typeof ARTICLE_INFLOW_SCHEMA_VERSION;
  environment: "staging" | "production";
  generated_at: string;
  feed_checksum: string;
  articles: ArticleInflowItem[];
  [key: string]: unknown;
}

export function calculateArticleBodyChecksum(body: string): string;
export function isSafeArticleInflowBody(body: string): boolean;
export function parseArticleInflowFeed(payload: unknown): ArticleInflowFeed | null;
