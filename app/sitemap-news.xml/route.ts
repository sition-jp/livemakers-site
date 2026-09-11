import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { buildNewsSitemapXml } from "@/lib/articles/news-sitemap";

/**
 * G3 (2026-09-11 田平氏 GO): Google News sitemap。直近 48h に公開された
 * 記事のみ (仕様上限)・最大 1000 件。5 分キャッシュ (`s-maxage=300`) —
 * News sitemap は鮮度が命なので記事本体の ISR (3600s) より短い。
 */
export const revalidate = 300;

export async function GET(): Promise<Response> {
  const catalog = await loadPublicArticleInflowCatalog();
  const xml = buildNewsSitemapXml(catalog.articles);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=300, stale-while-revalidate",
    },
  });
}
