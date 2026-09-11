import {
  buildArticleJsonLd,
  type ArticleJsonLdInput,
} from "@/lib/seo/article-json-ld";

/**
 * G3: 記事詳細ページに `NewsArticle` 構造化データを埋め込む。
 * ビルダー本体 (`lib/seo/article-json-ld.ts`) を分けているのは、
 * `article-metadata.ts` と同じくロジックだけを DOM 抜きでテストするため。
 */
export function ArticleJsonLd(props: ArticleJsonLdInput) {
  const json = buildArticleJsonLd(props);
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
