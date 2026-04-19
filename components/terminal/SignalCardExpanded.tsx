/**
 * SignalCardExpanded — primary human-readable summary for the detail page.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-task-1-3-signal-detail-design.md §5.6
 *
 * Responsibility: summary + top-3 evidence + position (if any). Does NOT
 * render full schema — that lives in SignalFieldGrid (§5.6.1).
 */
import type { Signal } from "@/lib/signals";

interface Props {
  signal: Signal;
  locale: "en" | "ja";
}

export function SignalCardExpanded({ signal, locale }: Props) {
  const headline = locale === "ja" ? signal.headline_ja : signal.headline_en;
  const summary = locale === "ja" ? signal.summary_ja : signal.summary_en;
  const isEnPending = locale === "en" && summary.includes("EN translation pending.");
  const cleanSummary = isEnPending
    ? summary.replace(/EN translation pending\./, "").trim()
    : summary;

  const topEvidence = (signal.evidence ?? []).slice(0, 3);
  const positionHint = (signal as Signal & { position_hint?: string }).position_hint;
  const conviction = (signal as Signal & { conviction?: number }).conviction;

  return (
    <article className="rounded-lg border-l-4 border-blue-500 bg-slate-50 dark:bg-slate-900/40 p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 text-xs uppercase tracking-wide">
        <span className="font-semibold">{signal.pillar}</span>
        {signal.primary_asset && <span>· {signal.primary_asset}</span>}
        <span className="ml-auto font-mono">{(signal.confidence * 100).toFixed(0)}%</span>
      </header>
      <h1 className="mt-2 text-xl font-semibold leading-tight">{headline}</h1>
      <p className="mt-3 whitespace-pre-line leading-relaxed">{cleanSummary}</p>

      <hr className="my-4 opacity-30" />
      <section className="text-sm flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="opacity-60">direction: </span>
          {signal.direction}
        </span>
        {signal.impact && (
          <span>
            <span className="opacity-60">impact: </span>
            {signal.impact}
          </span>
        )}
        {signal.time_horizon && (
          <span>
            <span className="opacity-60">horizon: </span>
            {signal.time_horizon}
          </span>
        )}
      </section>

      {positionHint && (
        <>
          <hr className="my-4 opacity-30" />
          <section className="text-sm">
            <span className="opacity-60">position: </span>
            <span className="font-medium">{positionHint}</span>
            {typeof conviction === "number" && (
              <span className="ml-2 opacity-60">conviction {conviction.toFixed(2)}</span>
            )}
          </section>
        </>
      )}

      {topEvidence.length > 0 && (
        <>
          <hr className="my-4 opacity-30" />
          <section className="text-sm">
            <h2 className="mb-2 text-xs uppercase tracking-wide opacity-60">
              Evidence ({topEvidence.length} of {signal.evidence?.length ?? 0})
            </h2>
            <ul className="space-y-1">
              {topEvidence.map((ev, i) => {
                const e = ev as { source_type?: string; title?: string; url?: string };
                return (
                  <li key={i} className="font-mono text-xs">
                    <span className="opacity-60">{e.source_type}</span> · {e.title}
                    {e.url && (
                      <>
                        {" · "}
                        <a href={e.url} className="underline" target="_blank" rel="noopener noreferrer">
                          link
                        </a>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {isEnPending && (
        <aside className="mt-4 text-xs italic text-amber-600">
          EN translation pending — full translation in Phase 2.
        </aside>
      )}
    </article>
  );
}
