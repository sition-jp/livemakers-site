import "server-only";

import { fetchProductionArticleInflowFeed } from "@/lib/articles/article-inflow-feed";
import {
  effectiveSurfacePublished,
  type FutureAtlasData,
} from "@/lib/future-atlas/load";

/**
 * P0-7 (T4-2): nav / route / SeriesRail が参照する実効 surfacePublished。
 * config が既に true なら feed を読まない。false の間だけ production feed
 * を照会し、family="future-atlas" の記事が載った時点で面が開く
 * (feed PUT の 1 トランザクションで記事掲載と面オープンが同時成立 = D-3)。
 * feed fetch は Next の revalidate キャッシュに乗る (追加コストは 300s に 1 回)。
 */
export async function loadEffectiveSurfacePublished(
  data: Pick<FutureAtlasData, "config">,
): Promise<boolean> {
  if (data.config.surfacePublished) return true;
  const feed = await fetchProductionArticleInflowFeed();
  return effectiveSurfacePublished(data.config, feed?.articles ?? null);
}
