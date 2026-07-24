import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleCardSmall } from "./ArticleCardSmall";
import { ArticleRow } from "./ArticleRow";

export interface DeepDiveShelfCopy {
  title: string;
  familyLabels: Record<ArticleFamily, string>;
}

/**
 * 右カラム① Deep Dive (G44 D7)。筆頭 1 本を featured (ArticleCardSmall・data-article-id・
 * 本体扱い) で大きく、残り最大 4 本を title 行 (ArticleRow・indexNav = data-index-nav) で
 * 索引扱いにする。featured のみ gate 6 の articleId 重複検査対象。
 */
export function DeepDiveShelf({
  articles,
  copy,
}: {
  articles: ArticleMeta[];
  copy: DeepDiveShelfCopy;
}) {
  const shelf = articles.slice(0, 5);
  const [featured, ...rest] = shelf;
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      {featured ? (
        <div className="mt-3">
          <ArticleCardSmall
            article={featured}
            familyLabel={copy.familyLabels[featured.family]}
          />
        </div>
      ) : null}
      {rest.length > 0 ? (
        <div className="mt-2 border-t border-border-primary">
          {rest.map((article) => (
            <ArticleRow
              key={article.articleId}
              article={article}
              familyLabel={copy.familyLabels[article.family]}
              indexNav
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
