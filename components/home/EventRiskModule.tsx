import eventRiskSchedule from "@/data/home/event-risk-schedule.json";
import type { ArticleMeta } from "@/lib/articles/article-model";
import type { HomeCopy } from "@/lib/home/home-copy";
import { ArticleCardSmall } from "./ArticleCardSmall";

/**
 * Event Risk = 最新 event-risk-radar 記事 1 本 + 「確定イベント」週次リスト。
 * Phase 3b (2026-08-14): サムネは 32:9 (16:9 の半分)・カード下に週次リスト
 * (data/home/event-risk-schedule.json — 更新は ERR writer レーンの週次改訂に載せる)。
 * 2026-10-26 田平氏 GO: PC は左列 (event-risk)・スマホは右列の最新記事の直前
 * (event-risk-mobile) で同じ中身を出す。
 */
export function EventRiskModule({
  article,
  familyLabels,
}: {
  article: ArticleMeta | null;
  familyLabels: HomeCopy["familyLabels"];
}) {
  return (
    <div className="space-y-3">
      {article ? (
        <ArticleCardSmall
          article={article}
          familyLabel={familyLabels[article.family]}
          thumbVariant="shortWide"
        />
      ) : null}
      <section
        data-event-risk-schedule
        className="rounded-lg border border-border-primary bg-bg-secondary p-4"
      >
        <h3 className="text-sm font-bold text-text-primary">
          {eventRiskSchedule.heading}
          <span className="ml-2 font-mono text-[10px] font-normal text-text-tertiary">
            {eventRiskSchedule.weekLabel}
          </span>
        </h3>
        <ul className="mt-2 space-y-1.5">
          {eventRiskSchedule.events.map((event) => (
            <li
              key={event}
              className="text-xs leading-relaxed text-text-secondary"
            >
              {event}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
