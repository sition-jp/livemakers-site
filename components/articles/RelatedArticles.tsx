import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleRow } from "@/components/home/ArticleRow";

/**
 * 記事末尾の関連記事 (G44 D10)。同シリーズ優先→同 lanes 補完の最大 4 本
 * (選定は lib/articles/related.ts)。0 本なら何も出さない。
 */
export function RelatedArticles({
  articles,
  title,
  familyLabels,
}: {
  articles: ArticleMeta[];
  title: string;
  familyLabels: Record<ArticleFamily, string>;
}) {
  if (articles.length === 0) return null;
  return (
    <section
      data-article-related=""
      data-index-nav=""
      className="mt-10 border-t border-border-primary pt-6"
    >
      <h2 className="text-sm font-bold text-text-primary">{title}</h2>
      <div className="mt-2 border-t border-border-primary">
        {articles.map((article) => (
          <ArticleRow
            key={article.articleId}
            article={article}
            familyLabel={familyLabels[article.family]}
            indexNav
          />
        ))}
      </div>
    </section>
  );
}
