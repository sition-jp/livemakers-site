import { Link } from "@/i18n/navigation";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleCardSmall } from "./ArticleCardSmall";
import { ArticleThumbRow } from "./ArticleThumbRow";

export interface DeepDiveShelfCopy {
  title: string;
  familyLabels: Record<ArticleFamily, string>;
  seriesLink: string;
}

/**
 * 右カラム① Deep Dive (G44 D7 / 2026-08-14 Phase 3b 改訂)。筆頭 1 本を
 * featured (ArticleCardSmall・data-article-id・本体扱い) で大きく、残り最大
 * 4 本を小サムネ付き行 (ArticleThumbRow・indexNav = data-index-nav) で索引
 * 扱いにする。featured のみ gate 6 の articleId 重複検査対象。末尾に
 * シリーズ一覧への索引リンクを置く。
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
            <ArticleThumbRow
              key={article.articleId}
              article={article}
              familyLabel={copy.familyLabels[article.family]}
              indexNav
            />
          ))}
        </div>
      ) : null}
      <div data-index-nav className="mt-3">
        <Link
          href="/articles/series/deep-dive"
          className="text-xs font-bold text-accent"
        >
          {copy.seriesLink}
        </Link>
      </div>
    </section>
  );
}
