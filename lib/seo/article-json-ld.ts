import type { ArticleFamily } from "@/lib/articles/article-model";
import { familyLabelJa } from "@/lib/articles/family-labels";
import {
  ABOUT_URL,
  EDITORIAL_DESK_NAME,
  SITE_LOGO_HEIGHT,
  SITE_LOGO_URL,
  SITE_LOGO_WIDTH,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

export interface ArticleJsonLdInput {
  articleId: string;
  titleJa: string;
  publishedAtJst: string;
  family: ArticleFamily;
  thumbnailUrl?: string;
  lang: "ja" | "en";
}

/**
 * G3 (2026-09-11 田平氏 GO): 記事詳細ページの `NewsArticle` JSON-LD。
 *
 * `dateModified` は現時点で本文の更新履歴を持たないため `datePublished`
 * と同値に固定 (タスク仕様どおり)。`inLanguage` は URL locale に関わらず
 * 常に "ja" — inflow feed に英語本文が存在せず `/en/articles/<slug>` も
 * 同じ日本語本文を描画するため、実体と食い違わない値はこれだけ。
 */
export function buildArticleJsonLd(article: ArticleJsonLdInput) {
  const url = `${SITE_URL}/${article.lang}/articles/${article.articleId}`;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.titleJa,
    datePublished: article.publishedAtJst,
    dateModified: article.publishedAtJst,
    author: {
      "@type": "Organization",
      name: EDITORIAL_DESK_NAME,
      url: ABOUT_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: SITE_LOGO_URL,
        width: SITE_LOGO_WIDTH,
        height: SITE_LOGO_HEIGHT,
      },
    },
    ...(article.thumbnailUrl ? { image: [article.thumbnailUrl] } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: familyLabelJa(article.family),
    inLanguage: "ja",
    isAccessibleForFree: true,
  };
}
