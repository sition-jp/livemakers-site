import "server-only";

import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { isArticleInflowV2Enabled } from "@/lib/articles/article-inflow-v2";
import { loadRailContext } from "@/lib/articles/article-detail-context";
import { trimRailArticles, type ArticleRailFeed } from "@/lib/articles/article-rail-feed";
import { loadFutureAtlas } from "@/lib/future-atlas/load";
import { loadEffectiveSurfacePublished } from "@/lib/future-atlas/surface";

/**
 * /api/article-rail が返す中身を組む (2026-11-20)。記事ページが前に HTML へ
 * 焼いていたのと同じ材料 — v2 が有効なら rail.json + リポジトリの記事、
 * 無効ならカタログ — から、レーンと関連記事に要る分だけを残す。
 */
export async function loadArticleRailFeed(): Promise<ArticleRailFeed> {
  const futureAtlas = await loadFutureAtlas();
  if (isArticleInflowV2Enabled()) {
    const { railArticles, surfacePublished } = await loadRailContext(futureAtlas.config);
    return { articles: trimRailArticles(railArticles), surfacePublished };
  }
  const [catalog, surfacePublished] = await Promise.all([
    loadPublicArticleInflowCatalog(),
    loadEffectiveSurfacePublished(futureAtlas),
  ]);
  return { articles: trimRailArticles(catalog.articles), surfacePublished };
}
