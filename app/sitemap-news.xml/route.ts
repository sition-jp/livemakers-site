import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { buildNewsSitemapXml } from "@/lib/articles/news-sitemap";

/**
 * G3 (2026-09-11 田平氏 GO): Google News sitemap。直近 48h に公開された
 * 記事のみ (仕様上限)・最大 1000 件。
 * 2026-10-26 段 1: 鮮度は記事の公開の合図 (lib/revalidate.ts の ARTICLE_FEED_PATHS)
 * で保つ。時間での作り直しは 6 時間の保険 (旧 5 分キャッシュ)。
 */
export const revalidate = 21600;

export async function GET(): Promise<Response> {
  const catalog = await loadPublicArticleInflowCatalog();
  const xml = buildNewsSitemapXml(catalog.articles);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=21600, stale-while-revalidate",
    },
  });
}
