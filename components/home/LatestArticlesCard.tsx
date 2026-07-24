import type {
  ArticleFamily,
  ArticleLane,
  ArticleMeta,
} from "@/lib/articles/article-model";
import { ArticleRow } from "./ArticleRow";

export interface LatestArticlesCopy {
  title: string;
  familyLabels: Record<ArticleFamily, string>;
  laneLabels: Record<ArticleLane, string>;
}

/**
 * 右カラム⑤ 最新記事 10 本 (G44 D7)。全 family を更新順に並べる索引モジュール。
 * latest-articles は INDEX_NAV_MODULES なので全行を indexNav (data-index-nav) で
 * 索引扱いにし、本体の重複検査 (gate 6) から除外する。lanes タグ付き。
 */
export function LatestArticlesCard({
  articles,
  copy,
}: {
  articles: ArticleMeta[];
  copy: LatestArticlesCopy;
}) {
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <div className="mt-2 border-t border-border-primary">
        {articles.map((article) => (
          <ArticleRow
            key={article.articleId}
            article={article}
            familyLabel={copy.familyLabels[article.family]}
            laneLabels={copy.laneLabels}
            indexNav
          />
        ))}
      </div>
    </section>
  );
}
