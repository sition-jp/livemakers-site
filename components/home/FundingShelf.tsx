import { Link } from "@/i18n/navigation";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleThumbRow } from "./ArticleThumbRow";

export interface FundingShelfCopy {
  title: string;
  viewAll: string;
  familyLabels: Record<ArticleFamily, string>;
}

/**
 * 右カラム 資金調達の枠 (入口 ②・資金調達テーマページ)。見出し + 最新 5 本の
 * 小サムネ付き行 (ArticleThumbRow・indexNav = data-index-nav) + 棚ページへの
 * 索引リンク。中央の Signal の時系列と同じ記事が大きく 2 回出ないよう、大きな
 * カード (ArticleCardSmall) は置かない。全行が索引扱いなので gate 6 の対象外。
 */
export function FundingShelf({
  articles,
  copy,
}: {
  articles: ArticleMeta[];
  copy: FundingShelfCopy;
}) {
  const shelf = articles.slice(0, 5);
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <div className="mt-2 border-t border-border-primary">
        {shelf.map((article) => (
          <ArticleThumbRow
            key={article.articleId}
            article={article}
            familyLabel={copy.familyLabels[article.family]}
            indexNav
          />
        ))}
      </div>
      <div data-index-nav className="mt-3">
        <Link href="/topics/funding" className="text-xs font-bold text-accent">
          {copy.viewAll}
        </Link>
      </div>
    </section>
  );
}
