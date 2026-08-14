import { Link } from "@/i18n/navigation";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleThumbRow } from "./ArticleThumbRow";

export interface SignalTimelineCopy {
  title: string;
  familyLabels: Record<ArticleFamily, string>;
  seriesLink: string;
}

/**
 * 中央カラム Signal 時系列 (G44 D6 / 2026-08-14 Phase 3b 改訂)。
 * slots.signalTimeline の全行を小サムネ付き行 (ArticleThumbRow) で描画する
 * (本体扱い・data-article-id・索引扱いにしない)。選定 (直近 24h・floor 10・
 * 昇格ペア除外) は selectSignalTimeline / selectHomeSlots が担い、本
 * コンポーネントは表示のみ。末尾にシリーズ一覧への索引リンクを置く。
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
          <ArticleThumbRow
            key={article.articleId}
            article={article}
            familyLabel={copy.familyLabels[article.family]}
          />
        ))}
      </div>
      <div data-index-nav className="mt-3">
        <Link
          href="/articles/series/signal"
          className="text-xs font-bold text-accent"
        >
          {copy.seriesLink}
        </Link>
      </div>
    </section>
  );
}
