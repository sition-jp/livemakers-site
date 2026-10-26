import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { buildRssFeedXml } from "@/lib/articles/rss-feed";
import { SITE_URL } from "@/lib/site";

/**
 * G3 (2026-09-11 田平氏 GO): `/feed` の救済。
 *
 * `/feed` (拡張子なし) は proxy.ts の next-intl middleware にマッチし、
 * localePrefix "always" の既定で `/ja/feed` へ 307 する。これまでは
 * `/ja/feed` に何のページも無かったため、その 307 が HTML の 404 に着地
 * していた (今回の課題)。canonical は `/ja/feed.xml` だが、実際に
 * リダイレクトされてくる `/ja/feed` にも同じ RSS を返し、拡張子の有無に
 * かかわらず購読が壊れないようにする。ビルダーは `rss-feed.ts` を共有
 * するので二重管理にはならない。
 */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const catalog = await loadPublicArticleInflowCatalog();
  const xml = buildRssFeedXml(catalog.articles, `${SITE_URL}/ja/feed.xml`);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
