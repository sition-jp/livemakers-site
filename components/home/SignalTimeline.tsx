import { Link } from "@/i18n/navigation";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleThumbRow } from "./ArticleThumbRow";

export interface SignalTimelineCopy {
  title: string;
  familyLabels: Record<ArticleFamily, string>;
  seriesLink: string;
  /** 整形済み (null = 描かない)。HomeCopy.gradient.signalFreshness 由来 */
  freshness: {
    todayCount: string | null;
    latestAt: string | null;
  };
}

/**
 * 中央カラム Signal 時系列 (G44 D6 / 2026-08-14 Phase 3b 改訂 / 2026-08-23 GO B-1)。
 * slots.signalTimeline の全行を小サムネ付き行 (ArticleThumbRow) で描画する
 * (本体扱い・data-article-id・索引扱いにしない)。選定 (直近 24h・floor 10・
 * 昇格ペア除外) は selectSignalTimeline / selectHomeSlots が担い、本
 * コンポーネントは表示のみ。ヘッダ行 = 見出し + 鮮度 (今日 N 本 · 最新 MM-DD HH:MM・
 * null セグメントは描かない) + 右端にシリーズ一覧リンク (索引)。
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
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
          {copy.freshness.todayCount ? (
            <span
              data-signal-freshness="today"
              className="font-mono text-[10px] text-text-tertiary"
            >
              · {copy.freshness.todayCount}
            </span>
          ) : null}
          {copy.freshness.latestAt ? (
            <span
              data-signal-freshness="latest"
              className="font-mono text-[10px] text-text-tertiary"
            >
              · {copy.freshness.latestAt}
            </span>
          ) : null}
        </div>
        <div data-index-nav className="shrink-0">
          <Link
            href="/articles/series/signal"
            className="whitespace-nowrap text-xs font-bold text-accent"
          >
            {copy.seriesLink}
          </Link>
        </div>
      </div>
      <div className="mt-2 border-t border-border-primary">
        {articles.map((article) => (
          <ArticleThumbRow
            key={article.articleId}
            article={article}
            familyLabel={copy.familyLabels[article.family]}
          />
        ))}
      </div>
    </section>
  );
}
