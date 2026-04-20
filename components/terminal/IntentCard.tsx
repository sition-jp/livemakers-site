/**
 * IntentCard — single TradeIntent as a terminal-style card in the list.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §4.3
 *
 * Overlay-link pattern (Task 1-3 SignalCard 踏襲): <article class="relative">
 * with absolute-positioned <Link className="absolute inset-0 z-10"> to keep
 * the article landmark while giving the whole card a click target.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { TradeIntentSummary } from "@/lib/intents-reader";

export interface IntentCardProps {
  summary: TradeIntentSummary;
  locale: "en" | "ja";
}

export function IntentCard({ summary, locale }: IntentCardProps) {
  const tCard = useTranslations("intents.card");
  const headline =
    locale === "ja" ? summary.display.headline_ja : summary.display.headline_en;
  const body =
    locale === "ja" ? summary.display.summary_ja : summary.display.summary_en;

  return (
    <article className="relative rounded-lg border border-slate-300/70 bg-white p-4 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
      <Link
        href={`/${locale}/intents/${summary.intent_id}`}
        aria-label={tCard("view_detail") + ": " + headline}
        className="absolute inset-0 z-10"
      />
      <header className="mb-2 flex flex-wrap gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
          {summary.side}
        </span>
        <span>{summary.preferred_horizon}</span>
        {summary.target_assets.map((a) => (
          <span
            key={a}
            className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
          >
            {a}
          </span>
        ))}
      </header>
      <h2 className="mb-1 text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
        {headline}
      </h2>
      <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">{body}</p>
      <footer className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
        <span>
          TC {summary.thesis_conviction.toFixed(2)} · EC{" "}
          {summary.execution_confidence.toFixed(2)}
        </span>
        <span>
          {tCard("source_signal_count", {
            count: summary.source_signal_ids.length,
          })}
        </span>
      </footer>
    </article>
  );
}
