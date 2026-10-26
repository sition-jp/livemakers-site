import "server-only";

import {
  isArticleInflowPublicEnabled,
} from "@/lib/articles/article-inflow-feed";
import {
  mapInflowArticle,
  type ArticleInflowPublicArticle,
} from "@/lib/articles/article-inflow-contract";
import {
  ARTICLE_BLOB_ORIGIN,
  parseArticleFamilyIndex,
  parseArticleRail,
  parseArticleRecord,
  type ArticleInflowCatalogItem,
} from "@/lib/articles/article-inflow-validation.mjs";
import { stripUnverifiedThumbnails } from "@/lib/articles/thumbnail-verification";

/**
 * カタログ v2 (段 2a・2026-10-27): 記事ページ用の小さなファイルを読む。
 *
 * 記事ページは v1 カタログ (1.6MB・データキャッシュの上限 2MB を保存の形で
 * 超える) を読まず、記事 1 本の記録だけを必須として読む。記録は期限なしで
 * 保存し (`force-cache`)、記事の合図 (`articleRecordTag`) でだけ消す —
 * Next.js 16 は期限切れの保存を作り直しの最中に取り直しを待つので
 * (patch-fetch.js:752)、時間で切れる保存では Blob の 403 の間に記事ページを
 * 守れない。Vercel のデータキャッシュはデプロイをまたいで残る。
 *
 * rail と前後リンクの一覧は「なくても描ける」もの。取れなければ null。
 * 計画: sition-core 08_DOCS/knowledge/plans/2026-10-27-lvm-catalog-v2-article-detail-plan.md
 */

export const ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_V2_BASE_URL";
const FETCH_ATTEMPTS = 2;
const FETCH_TIMEOUT_MS = 4_000;
const OPTIONAL_REVALIDATE_SECONDS = 3600;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HREF_BASE = "/articles";
// 手元の確認 (Task 7) のための配信サーバーだけを Blob 以外に許す。
// 本番の値が localhost を指すことはない
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export type ArticleRecordResult =
  | { kind: "found"; article: ArticleInflowPublicArticle }
  | { kind: "missing" }
  | { kind: "unavailable" };

export type ArticleRail = {
  generatedAt: string;
  latest: ArticleInflowPublicArticle[];
  byFamily: Record<string, ArticleInflowPublicArticle[]>;
};

export type ArticleFamilyIndex = {
  family: string;
  items: { slug: string; title: string; publishedAt: string }[];
};

function v2BaseUrl(): string | null {
  const value = process.env[ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY]?.replace(/\/+$/, "");
  if (!value) return null;
  if (value.startsWith(`${ARTICLE_BLOB_ORIGIN}/`)) return value;
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname) ? value : null;
  } catch {
    return null;
  }
}

export function isArticleInflowV2Enabled(): boolean {
  return isArticleInflowPublicEnabled() && v2BaseUrl() !== null;
}

export function articleRecordTag(slug: string): string {
  return `lvm-article-record:${slug}`;
}

export function familyFromSlug(slug: string): string | null {
  return /^(.+)-\d{8}-[0-9a-f]{8}$/.exec(slug)?.[1] ?? null;
}

function toArticle(item: ArticleInflowCatalogItem): ArticleInflowPublicArticle {
  const [verified] = stripUnverifiedThumbnails({ articles: [item] }).articles;
  return mapInflowArticle(verified, HREF_BASE);
}

/** 取得して JSON を返す。404 は "missing"、それ以外の失敗は null (2 回試す)。 */
async function fetchJson(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<unknown | "missing" | null> {
  let lastFailure = "unknown";
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetcher(url, {
        ...init,
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.status === 404) return "missing";
      if (response.ok) return await response.json();
      lastFailure = `status ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
  }
  console.warn(`[article-inflow-v2] ${url} unavailable after ${FETCH_ATTEMPTS} attempts (${lastFailure})`);
  return null;
}

export async function fetchArticleRecord(
  slug: string,
  fetcher: typeof fetch = fetch,
): Promise<ArticleRecordResult> {
  const base = v2BaseUrl();
  if (!base) return { kind: "unavailable" };
  if (!SLUG_PATTERN.test(slug)) return { kind: "missing" };
  const payload = await fetchJson(
    `${base}/records/${slug}.json`,
    { cache: "force-cache", next: { tags: [articleRecordTag(slug)] } },
    fetcher,
  );
  if (payload === "missing") return { kind: "missing" };
  if (payload === null) return { kind: "unavailable" };
  const record = parseArticleRecord(payload);
  if (!record || record.environment !== "production") {
    console.warn(`[article-inflow-v2] record contract rejected for slug=${slug}`);
    return { kind: "unavailable" };
  }
  if ("withdrawn" in record) {
    return record.slug === slug ? { kind: "missing" } : { kind: "unavailable" };
  }
  if (record.article.slug !== slug) {
    console.warn(`[article-inflow-v2] record slug mismatch for slug=${slug}`);
    return { kind: "unavailable" };
  }
  return { kind: "found", article: toArticle(record.article) };
}

export async function fetchArticleRail(
  fetcher: typeof fetch = fetch,
): Promise<ArticleRail | null> {
  const base = v2BaseUrl();
  if (!base) return null;
  const payload = await fetchJson(
    `${base}/rail.json`,
    { next: { revalidate: OPTIONAL_REVALIDATE_SECONDS } },
    fetcher,
  );
  const rail = payload && payload !== "missing" ? parseArticleRail(payload) : null;
  if (!rail || rail.environment !== "production") return null;
  return {
    generatedAt: rail.generated_at,
    latest: rail.latest.map(toArticle),
    byFamily: Object.fromEntries(
      Object.entries(rail.by_family).map(([family, items]) => [family, items.map(toArticle)]),
    ),
  };
}

export async function fetchArticleFamilyIndex(
  family: string,
  fetcher: typeof fetch = fetch,
): Promise<ArticleFamilyIndex | null> {
  const base = v2BaseUrl();
  if (!base || !SLUG_PATTERN.test(family)) return null;
  const payload = await fetchJson(
    `${base}/families/${family}.json`,
    { next: { revalidate: OPTIONAL_REVALIDATE_SECONDS } },
    fetcher,
  );
  const index = payload && payload !== "missing" ? parseArticleFamilyIndex(payload) : null;
  if (!index || index.environment !== "production" || index.family !== family) return null;
  return {
    family: index.family,
    items: index.items.map((item) => ({
      slug: item.slug,
      title: item.title,
      publishedAt: item.published_at,
    })),
  };
}
