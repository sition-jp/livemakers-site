import { Link } from "@/i18n/navigation";
import type { ArticleFamily, ArticleMeta } from "@/lib/articles/article-model";
import { ArticleRow, FAMILY_COLORS } from "./ArticleRow";

export interface SignalTimelineCopy {
  title: string;
  familyLabels: Record<ArticleFamily, string>;
}

/**
 * 中央カラム Signal 時系列 (G44 D6 / 2026-08-14 Phase 3 改訂)。
 * slots.signalTimeline を描画する (本体扱い・data-article-id・索引扱いにしない)。
 * 選定 (直近 24h・floor 10・昇格ペア除外) は selectSignalTimeline /
 * selectHomeSlots が担い、本コンポーネントは表示のみ。
 * 先頭 1 本だけ小サムネ付きの行 (data-signal-lead) で描き、サムネが無い記事は
 * family 色のグラデーション帯で枠を保つ (CLS ゼロ・検証済み URL のみが
 * thumbnailUrl に載る前提は ArticleThumbnail と同じ)。2 本目以降は従来の
 * ArticleRow (サムネなし)。
 */
export function SignalTimeline({
  articles,
  copy,
}: {
  articles: ArticleMeta[];
  copy: SignalTimelineCopy;
}) {
  const [lead, ...rest] = articles;
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <div className="mt-2 border-t border-border-primary">
        {lead ? (
          <Link
            href={lead.href}
            data-article-id={lead.articleId}
            data-signal-lead
            className="group flex items-center gap-3 border-b border-border-primary px-3 py-2.5 text-left transition-colors hover:bg-bg-tertiary"
          >
            <span className="w-24 shrink-0 overflow-hidden rounded">
              {lead.thumbnailUrl ? (
                // Blob origin は next/image の許可リスト外運用のため素の img
                // (ArticleThumbnail と同じ判断)。小サムネは 16:9 のまま。
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lead.thumbnailUrl}
                  alt={lead.titleJa}
                  width={160}
                  height={90}
                  className="aspect-[16/9] h-auto w-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="block aspect-[16/9] w-full opacity-80"
                  style={{
                    background: `linear-gradient(120deg, ${FAMILY_COLORS[lead.family]}, transparent)`,
                  }}
                />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-text-primary group-hover:underline">
                {lead.titleJa}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold tracking-label"
                  style={{
                    borderColor: FAMILY_COLORS[lead.family],
                    color: FAMILY_COLORS[lead.family],
                  }}
                >
                  {copy.familyLabels[lead.family]}
                </span>
                <time className="whitespace-nowrap font-mono text-[10px] text-text-tertiary">
                  {lead.publishedLabel}
                </time>
              </span>
            </span>
          </Link>
        ) : null}
        {rest.map((article) => (
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
