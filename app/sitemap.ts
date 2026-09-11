import type { MetadataRoute } from "next";

import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { SERIES_SLUGS } from "@/lib/articles/article-model";
import { SITE_URL } from "@/lib/site";

/**
 * G3 (2026-09-11 田平氏 GO): sitemap.xml が 404 だった穴を塞ぐ。
 *
 * 記事は本番カタログ (`loadPublicArticleInflowCatalog` — repository
 * fixture + inflow feed の合成、記事詳細ページと同じ関数) から機械生成する。
 *
 * ja のみを載せる (en は含めない): inflow feed の契約
 * (`article-inflow-validation.mjs`) に English title/body フィールドが
 * 無く、`/en/articles/<slug>` は EN 訳ではなく JA 本文をそのまま再描画する
 * (`article-inflow-feed.ts` の `loadArticleInflowDetail` は inflow 記事の
 * body を locale 引数で分岐しない)。実在しない翻訳の URL を sitemap に
 * 載せると、Google に重複コンテンツとして扱われる URL を自ら増やすだけに
 * なるため、真の翻訳が入るまでは ja のみとする。
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await loadPublicArticleInflowCatalog();

  const articleEntries: MetadataRoute.Sitemap = catalog.articles.map(
    (article) => ({
      url: `${SITE_URL}/ja${article.href}`,
      lastModified: article.publishedAtJst,
    }),
  );

  const seriesEntries: MetadataRoute.Sitemap = SERIES_SLUGS.map((slug) => ({
    url: `${SITE_URL}/ja/articles/series/${slug}`,
  }));

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/ja` },
    { url: `${SITE_URL}/ja/about` },
    { url: `${SITE_URL}/ja/editorial-policy` },
    { url: `${SITE_URL}/ja/contact` },
    { url: `${SITE_URL}/ja/privacy` },
  ];

  return [...staticEntries, ...seriesEntries, ...articleEntries];
}
