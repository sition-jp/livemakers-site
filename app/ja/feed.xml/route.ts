import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { buildRssFeedXml } from "@/lib/articles/rss-feed";
import { SITE_URL } from "@/lib/site";

/**
 * G3 (2026-09-11 田平氏 GO): RSS 2.0 — 最新 50 本。
 *
 * このルートは `app/[locale]/...` の外 (literal `/ja/feed.xml`) に置く。
 * next-intl proxy の matcher (`proxy.ts`) は拡張子を含むパスを除外して
 * いる (`.*\\..*` の negative lookahead) ため、このルートは locale
 * redirect を経由せず直接届く。`/ja/feed` (拡張子なし) は同じ内容を返す
 * 隣の route (`app/ja/feed/route.ts`) が担う。
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
