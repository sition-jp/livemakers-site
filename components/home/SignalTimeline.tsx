import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleRow } from "./ArticleRow";

export interface SignalTimelineCopy {
  title: string;
  familyLabels: Record<ArticleFamily, string>;
}

/**
 * 中央カラム② Signal 時系列 (G44 D6)。slots.signalTimeline を ArticleRow で描画する
 * (本体扱い・data-article-id・索引扱いにしない)。選定 (直近 24h・floor 10・昇格ペア除外) は
 * selectSignalTimeline / selectHomeSlots が担い、本コンポーネントは表示のみ。
 */
export function SignalTimeline({
  articles,
  copy,
}: {
  articles: ArticleMeta[];
  copy: SignalTimelineCopy;
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
          />
        ))}
      </div>
    </section>
  );
}
