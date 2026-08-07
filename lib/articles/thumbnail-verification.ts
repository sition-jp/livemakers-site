import { createHash } from "node:crypto";

import {
  ARTICLE_THUMBNAIL_DOCTRINE,
  ARTICLE_THUMBNAIL_ORIGIN,
  type ArticleInflowFeed,
  type ArticleInflowItem,
} from "@/lib/articles/article-inflow-validation.mjs";

/**
 * サムネ検証 (P2-LVM-INFLOW-G2 D3・T1a)。
 *
 * feed のサムネ宣言を記事単位で検証し、通らない記事は **サムネ 3 項目だけを
 * 剥がして記事本体は生存させる** (局所 degradation・feed 全体を reject しない)。
 * 無音 skip にしない — 剥がした理由は console.warn で観測可能にする。
 *
 * 検証内容:
 * - atomic union: mirror 記事は thumbnail_url / thumbnail_checksum /
 *   thumbnail_doctrine="no_overlay" の 3 項目が揃うこと (1 つでも欠けたら無効)。
 *   site-first 記事は T4-2 契約 (url + checksum) を維持し doctrine は任意
 *   (存在する場合の値は zod が no_overlay に固定済み)
 * - exact origin: ARTICLE_THUMBNAIL_ORIGIN 配下の https URL のみ。redirect 不可
 * - checksum: 取得した bytes の sha256 が thumbnail_checksum と一致すること
 *
 * URL は content-addressed (immutable) 前提のため、検証結果は
 * `url#checksum` キーでプロセス内 memoize する (再検証の fetch を省く)。
 */

export type ThumbnailRejectReason =
  | "union_incomplete"
  | "origin_not_allowed"
  | "fetch_failed"
  | "checksum_mismatch";

const verifiedCache = new Map<string, boolean>();

function hasAllowedOrigin(url: string): boolean {
  return url.startsWith(`${ARTICLE_THUMBNAIL_ORIGIN}/`);
}

function unionComplete(article: ArticleInflowItem): boolean {
  const isMirror = "source_x_url" in article;
  if (article.thumbnail_url === undefined || article.thumbnail_checksum === undefined) {
    return false;
  }
  if (isMirror && article.thumbnail_doctrine !== ARTICLE_THUMBNAIL_DOCTRINE) {
    return false;
  }
  return true;
}

async function verifyThumbnailBytes(
  url: string,
  checksum: string,
  fetcher: typeof fetch,
): Promise<ThumbnailRejectReason | null> {
  const cacheKey = `${url}#${checksum}`;
  const cached = verifiedCache.get(cacheKey);
  if (cached !== undefined) return cached ? null : "checksum_mismatch";
  try {
    const response = await fetcher(url, { redirect: "error" });
    if (!response.ok) return "fetch_failed";
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = createHash("sha256").update(bytes).digest("hex");
    const ok = digest === checksum;
    verifiedCache.set(cacheKey, ok);
    return ok ? null : "checksum_mismatch";
  } catch {
    // 取得失敗は一時要因でありうるので memoize しない (翌 revalidate で再試行)
    return "fetch_failed";
  }
}

function stripThumbnail(article: ArticleInflowItem): ArticleInflowItem {
  const {
    thumbnail_url: _url,
    thumbnail_checksum: _checksum,
    thumbnail_doctrine: _doctrine,
    ...rest
  } = article;
  return rest as ArticleInflowItem;
}

/** テスト用: memoize を破棄する */
export function clearThumbnailVerificationCache(): void {
  verifiedCache.clear();
}

export async function stripUnverifiedThumbnails(
  feed: ArticleInflowFeed,
  fetcher: typeof fetch = fetch,
): Promise<ArticleInflowFeed> {
  const articles = await Promise.all(
    feed.articles.map(async (article) => {
      if (
        article.thumbnail_url === undefined
        && article.thumbnail_checksum === undefined
        && article.thumbnail_doctrine === undefined
      ) {
        return article;
      }
      let reason: ThumbnailRejectReason | null = null;
      if (!unionComplete(article)) {
        reason = "union_incomplete";
      } else if (!hasAllowedOrigin(article.thumbnail_url!)) {
        reason = "origin_not_allowed";
      } else {
        reason = await verifyThumbnailBytes(
          article.thumbnail_url!,
          article.thumbnail_checksum!,
          fetcher,
        );
      }
      if (reason === null) return article;
      console.warn(
        `[article-inflow] thumbnail rejected (${reason}); serving placeholder for slug=${article.slug}`,
      );
      return stripThumbnail(article);
    }),
  );
  return { ...feed, articles };
}
