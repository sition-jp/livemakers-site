import "server-only";

import {
  getAllArticles,
  getArticleBody,
} from "@/lib/articles/article-model";
import {
  buildArticleInflowPublicCatalog,
  buildArticleInflowPreviewCatalog,
  calculateArticleBodyChecksum,
  isSafeArticleInflowBody,
  parseArticleInflowFeed,
  type ArticleInflowFeed,
  type ArticleInflowPublicCatalog,
  type ArticleInflowPreviewArticle,
  type ArticleInflowPreviewCatalog,
} from "@/lib/articles/article-inflow-contract";
import { stripUnverifiedThumbnails } from "@/lib/articles/thumbnail-verification";

export const ARTICLE_INFLOW_FEED_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_FEED_URL";
export const ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED";
export const ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY =
  "LIVEMAKERS_ARTICLE_INFLOW_PRODUCTION_FEED_URL";
export const ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY = "LIVEMAKERS_ARTICLE_INFLOW_PUBLIC_ENABLED";

export interface ArticleInflowPreviewDetail {
  article: ArticleInflowPreviewArticle;
  body: string;
  declaredBodyChecksum: string;
  renderedBodyChecksum: string;
}
export type ArticleInflowPublicDetail = ArticleInflowPreviewDetail;
export { isSafeArticleInflowBody };

export function isArticleInflowPreviewEnabled(): boolean {
  const value = process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY];
  return value === "1" || value === "true";
}

export function isArticleInflowPublicEnabled(): boolean {
  const value = process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];
  return value === "1" || value === "true";
}

/**
 * 2026-08-23 (田平氏 GO): one bounded retry before the repository-only
 * degrade — same posture as the terminal feed (#106). Right after the #107
 * deploy (14:47–14:53 JST) only the article feed failed to load while the
 * Blob payload and this loader were verified sound; /ja pinned the
 * repository-only render in ISR for 5 minutes and a fresh /en prerender at
 * 14:51 failed the same way — the fourth "先祖返り" read of a transient fetch
 * (8/10, 8/11, 8/23 ×2, all right after deploys). Only fetch-level failures
 * (thrown error, non-ok status, unreadable body) retry; a payload the
 * contract rejects is returned as null immediately because it will not
 * change on retry. The failure reason is included in the warning so Vercel
 * runtime logs can tell the failure modes apart. Two attempts × the
 * per-attempt timeout stay inside the route budget (the terminal feed fetch
 * runs in parallel, not in series).
 */
export const ARTICLE_INFLOW_FEED_FETCH_ATTEMPTS = 2;
export const ARTICLE_INFLOW_FEED_FETCH_TIMEOUT_MS = 4_000;

/**
 * 2026-08-23 (田平氏 GO 案 B): in-process memo + single-flight.
 *
 * The production feed (1.67MB, 148 articles with bodies) exceeds the Next.js
 * fetch-cache per-item limit — `incremental-cache` rejects items whose
 * JSON.stringify (body stored as base64, ×4/3 ≈ 2.22MB) is over 2MB, logged
 * on Vercel as "Failed to set Next.js data cache … items over 2MB can not be
 * cached". So `next: { revalidate: 3600 }` below never applied to this feed:
 * every render of every page that loads the catalog re-downloaded 1.67MB
 * from Blob. Right after a deploy / the hourly revalidate, dozens of article
 * pages re-render at once → dozens of concurrent 1.67MB downloads → some
 * fail → `repository_only` (the "先祖返り" read on 8/10, 8/11, 8/23 ×2).
 *
 * This memo keeps the last validated feed per (url, environment) in module
 * scope for ARTICLE_INFLOW_FEED_MEMO_TTL_MS and collapses concurrent calls
 * into one in-flight load, so a warm Fluid instance downloads the feed once
 * per window instead of once per render. Failures (null) are never memoized.
 * The TTL is deliberately short (2 minutes, not the 5-minute ISR window):
 * the site-first publish path pushes an on-demand revalidate right after a
 * new article lands, and a long memo would hold the previous catalog on
 * warm instances. The structural fix (split the feed into a body-less
 * catalog + per-article bodies) is a separate gate.
 */
export const ARTICLE_INFLOW_FEED_MEMO_TTL_MS = 120_000;

interface InflowFeedMemoEntry {
  at: number;
  feed: ArticleInflowFeed;
}

const inflowFeedMemo = new Map<string, InflowFeedMemoEntry>();
const inflowFeedInFlight = new Map<string, Promise<ArticleInflowFeed | null>>();

/** テスト用: memo と in-flight を破棄する。 */
export function resetArticleInflowFeedMemo(): void {
  inflowFeedMemo.clear();
  inflowFeedInFlight.clear();
}

function memoKey(url: string, requiredEnvironment?: string): string {
  return `${requiredEnvironment ?? "any"}|${url}`;
}

async function loadValidatedArticleInflowFeedMemoized(
  url: string,
  fetcher: typeof fetch,
  requiredEnvironment?: ArticleInflowFeed["environment"],
): Promise<ArticleInflowFeed | null> {
  const key = memoKey(url, requiredEnvironment);
  const now = Date.now();
  const cached = inflowFeedMemo.get(key);
  if (cached && now - cached.at <= ARTICLE_INFLOW_FEED_MEMO_TTL_MS) {
    return cached.feed;
  }
  const inFlight = inflowFeedInFlight.get(key);
  if (inFlight) return inFlight;
  const load = fetchValidatedArticleInflowFeed(url, fetcher, requiredEnvironment)
    .then((feed) => {
      if (feed) inflowFeedMemo.set(key, { at: Date.now(), feed });
      return feed;
    })
    .finally(() => {
      inflowFeedInFlight.delete(key);
    });
  inflowFeedInFlight.set(key, load);
  return load;
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function fetchValidatedArticleInflowFeed(
  url: string,
  fetcher: typeof fetch,
  requiredEnvironment?: ArticleInflowFeed["environment"],
): Promise<ArticleInflowFeed | null> {
  let lastFailure = "unknown";
  for (
    let attempt = 1;
    attempt <= ARTICLE_INFLOW_FEED_FETCH_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const response = await fetcher(url, {
        headers: { Accept: "application/json" },
        // ISR cost doctrine (2026-08-21 田平氏 GO): 300s data cache が
        // 全記事ページの実効 ISR 間隔を 5 分へ引き戻し、ISR Writes 42万回/11日
        // + Fluid CPU 38h の主因になっていた。鮮度は公開レーンの on-demand
        // revalidate (push purge) が担うため 3600s で読者影響なし。
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(ARTICLE_INFLOW_FEED_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        lastFailure = `status ${response.status}`;
      } else {
        const raw = await response.json();
        const feed = parseArticleInflowFeed(raw);
        if (!feed || (requiredEnvironment && feed.environment !== requiredEnvironment)) {
          console.warn("[article-inflow] feed contract rejected; using repository-only content");
          return null;
        }
        // T1a (INFLOW-G2 D3): サムネは origin / atomic union / bytes checksum を
        // 検証し、通らない記事はサムネのみ剥がす (記事と feed は生存)
        return await stripUnverifiedThumbnails(feed, fetcher);
      }
    } catch (error) {
      lastFailure = describeFailure(error);
    }
    if (attempt < ARTICLE_INFLOW_FEED_FETCH_ATTEMPTS) {
      console.warn(
        `[article-inflow] feed fetch attempt ${attempt}/${ARTICLE_INFLOW_FEED_FETCH_ATTEMPTS} failed (${lastFailure}); retrying`,
      );
    }
  }
  console.warn(
    `[article-inflow] feed request failed after ${ARTICLE_INFLOW_FEED_FETCH_ATTEMPTS} attempts (${lastFailure}); using repository-only content`,
  );
  return null;
}

export async function fetchArticleInflowFeed(
  fetcher: typeof fetch = fetch,
): Promise<ArticleInflowFeed | null> {
  const url = process.env[ARTICLE_INFLOW_FEED_ENV_KEY];
  if (!url) return null;
  return loadValidatedArticleInflowFeedMemoized(url, fetcher);
}

export async function fetchProductionArticleInflowFeed(
  fetcher: typeof fetch = fetch,
): Promise<ArticleInflowFeed | null> {
  if (!isArticleInflowPublicEnabled()) return null;
  const url = process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY];
  if (!url) return null;
  return loadValidatedArticleInflowFeedMemoized(url, fetcher, "production");
}

export async function loadArticleInflowPreviewCatalog(): Promise<ArticleInflowPreviewCatalog> {
  return buildArticleInflowPreviewCatalog(getAllArticles(), await fetchArticleInflowFeed());
}

export async function loadPublicArticleInflowCatalog(): Promise<ArticleInflowPublicCatalog> {
  return buildArticleInflowPublicCatalog(
    getAllArticles(),
    await fetchProductionArticleInflowFeed(),
  );
}

async function loadArticleInflowDetail(
  catalog: ArticleInflowPreviewCatalog,
  slug: string,
  locale: "ja" | "en",
): Promise<ArticleInflowPreviewDetail | null> {
  const article = catalog.articles.find((candidate) => candidate.articleId === slug);
  if (!article) return null;
  const body = article.source === "inflow"
    ? article.inflowBody!
    : getArticleBody(slug, locale);
  const renderedBodyChecksum = calculateArticleBodyChecksum(body);
  return {
    article,
    body,
    declaredBodyChecksum: article.declaredBodyChecksum ?? renderedBodyChecksum,
    renderedBodyChecksum,
  };
}

export async function loadArticleInflowPreviewDetail(
  slug: string,
  locale: "ja" | "en",
): Promise<ArticleInflowPreviewDetail | null> {
  return loadArticleInflowDetail(await loadArticleInflowPreviewCatalog(), slug, locale);
}

export async function loadPublicArticleInflowDetail(
  slug: string,
  locale: "ja" | "en",
): Promise<ArticleInflowPublicDetail | null> {
  return loadArticleInflowDetail(await loadPublicArticleInflowCatalog(), slug, locale);
}
