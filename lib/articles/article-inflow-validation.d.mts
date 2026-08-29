export const ARTICLE_INFLOW_SCHEMA_VERSION: "livemakers_article_inflow_feed_v0";
export const SITE_FIRST_LANE: "P2-LVM-SITEFIRST-G1";
export const SITE_FIRST_DOCTRINE: "livemakers-sitefirst-policy-publish";
export const ARTICLE_THUMBNAIL_DOCTRINE: "no_overlay";
export const ARTICLE_THUMBNAIL_ORIGIN: "https://p80f4ywborfbatou.public.blob.vercel-storage.com";

export type ArticleInflowFamily =
  | "daily-intel"
  | "signal"
  | "deep-dive"
  | "future-map"
  | "mkt12-morning"
  | "mkt12-weekend"
  | "event-risk-radar"
  | "weekly-brief"
  | "session"
  | "future-atlas";

export type ArticleInflowProvenance =
  | {
      approval_model: "policy";
      lane: typeof SITE_FIRST_LANE;
      doctrine: typeof SITE_FIRST_DOCTRINE;
    }
  | { approval_model: "go_record"; go_record_id: string };

export interface ArticleInflowItemCommon {
  slug: string;
  title: string;
  family: ArticleInflowFamily;
  /** mirror 型のみ (site-first 型は provenance と排他) */
  source_x_url?: string;
  /** site-first 型のみ (mirror 型は source_x_url と排他) */
  provenance?: ArticleInflowProvenance;
  thumbnail_url?: string;
  thumbnail_checksum?: string;
  thumbnail_doctrine?: typeof ARTICLE_THUMBNAIL_DOCTRINE;
  excerpt?: string;
  lanes?: Array<"macro" | "crypto" | "rwa">;
  published_at: string;
  body_checksum: string;
  validator: {
    verdict: "green";
    vocabulary_version: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ArticleInflowItem extends ArticleInflowItemCommon {
  body: string;
  body_url?: undefined;
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

// ---- catalog v1 (P2-LVM-FEEDSPLIT-G1) ----------------------------------
export const ARTICLE_INFLOW_CATALOG_SCHEMA_VERSION: "livemakers_article_inflow_catalog_v1";
export const ARTICLE_INFLOW_BODY_SCHEMA_VERSION: "livemakers_article_inflow_body_v1";
export const ARTICLE_BLOB_ORIGIN: "https://p80f4ywborfbatou.public.blob.vercel-storage.com";

/** v0 item から body を落とし body_url (origin pin 済) を足した射影 */
export interface ArticleInflowCatalogItem extends ArticleInflowItemCommon {
  body?: undefined;
  body_url: string;
}

export interface ArticleInflowCatalog {
  schema_version: typeof ARTICLE_INFLOW_CATALOG_SCHEMA_VERSION;
  environment: "staging" | "production";
  generated_at: string;
  feed_checksum: string;
  source_feed_checksum: string;
  articles: ArticleInflowCatalogItem[];
  [key: string]: unknown;
}

/** v0 feed / v1 catalog のどちらでも記事 overlay として扱える供給源 */
export type ArticleInflowSource = ArticleInflowFeed | ArticleInflowCatalog;
export type ArticleInflowSourceItem = ArticleInflowItem | ArticleInflowCatalogItem;

export function parseArticleInflowCatalog(
  payload: unknown,
): ArticleInflowCatalog | null;
export function parseArticleInflowBody(
  payload: unknown,
  expected: { slug: string; bodyChecksum: string },
): string | null;
