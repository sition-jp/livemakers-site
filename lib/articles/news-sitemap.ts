import type { ArticleInflowPublicArticle } from "@/lib/articles/article-inflow-contract";
import { escapeXml } from "@/lib/articles/xml-escape";
import { SITE_URL } from "@/lib/site";

/** Google News sitemap の window (仕様上限は 48h)。 */
export const NEWS_SITEMAP_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Google News sitemap の 1 ファイルあたり URL 上限。 */
export const NEWS_SITEMAP_MAX_URLS = 1000;

export function selectNewsSitemapArticles(
  articles: ArticleInflowPublicArticle[],
  now: Date,
): ArticleInflowPublicArticle[] {
  const cutoff = now.getTime() - NEWS_SITEMAP_WINDOW_MS;
  return articles
    .filter((article) => new Date(article.publishedAtJst).getTime() >= cutoff)
    .slice(0, NEWS_SITEMAP_MAX_URLS);
}

/**
 * Google News sitemap XML を組む。
 * 参照: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 */
export function buildNewsSitemapXml(
  articles: ArticleInflowPublicArticle[],
  now: Date = new Date(),
): string {
  const selected = selectNewsSitemapArticles(articles, now);
  const urlEntries = selected
    .map((article) => {
      const loc = `${SITE_URL}/ja${article.href}`;
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>LiveMakers</news:name>
        <news:language>ja</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(article.publishedAtJst)}</news:publication_date>
      <news:title>${escapeXml(article.titleJa)}</news:title>
    </news:news>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlEntries}
</urlset>
`;
}
