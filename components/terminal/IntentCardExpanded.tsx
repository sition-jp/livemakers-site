/**
 * IntentCardExpanded — core UX for the detail page.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §4.5
 *
 * Large display of thesis / why_now / invalidation_thesis — the three
 * fields the reader cares about most. Displays locale-specific headline +
 * summary as a header, then section-by-section.
 */
import { useTranslations } from "next-intl";
import type { TradeIntent } from "@/lib/intents";

export interface IntentCardExpandedProps {
  intent: TradeIntent;
  locale: "en" | "ja";
}

export function IntentCardExpanded({ intent, locale }: IntentCardExpandedProps) {
  const tSection = useTranslations("intents.detail.section");
  const headline =
    locale === "ja" ? intent.display.headline_ja : intent.display.headline_en;
  const summary =
    locale === "ja" ? intent.display.summary_ja : intent.display.summary_en;

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
            {intent.side}
          </span>
          <span>{intent.preferred_horizon}</span>
          {intent.target_assets.map((a) => (
            <span
              key={a}
              className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
            >
              {a}
            </span>
          ))}
        </div>
        <h1 className="text-2xl font-semibold leading-tight text-slate-900 dark:text-slate-100">
          {headline}
        </h1>
        <p className="text-base text-slate-700 dark:text-slate-300">
          {summary}
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {tSection("thesis")}
        </h2>
        <p className="text-base leading-relaxed text-slate-800 dark:text-slate-200">
          {intent.thesis}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {tSection("why_now")}
        </h2>
        <p className="text-base leading-relaxed text-slate-800 dark:text-slate-200">
          {intent.why_now}
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {tSection("invalidation")}
        </h2>
        <p className="text-base leading-relaxed text-slate-800 dark:text-slate-200">
          {intent.invalidation_thesis}
        </p>
      </section>
    </article>
  );
}
