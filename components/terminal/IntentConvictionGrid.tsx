/**
 * IntentConvictionGrid — 2×2 numeric display for the detail page.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §4.6
 *
 * The separation of thesis_conviction and execution_confidence is a core UX
 * decision (3-layer spec §4.4). A subtle warning marker is rendered when
 * they are exactly equal — likely a sign the distinction collapsed.
 */
import { useTranslations } from "next-intl";

export interface IntentConvictionGridProps {
  thesis_conviction: number;
  execution_confidence: number;
  priority: number;
  preferred_horizon: "intraday" | "swing" | "position" | "multi-week";
  bucket: "core" | "tactical" | "experimental" | "hedge";
  locale: "en" | "ja";
}

function Cell({
  label,
  hint,
  value,
  warn,
}: {
  label: string;
  hint?: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 border border-slate-300/70 p-3 dark:border-slate-700"
      data-conviction-parity-warning={warn ? "true" : undefined}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="font-mono text-2xl text-slate-900 dark:text-slate-100">
        {value}
      </div>
      {hint ? (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function IntentConvictionGrid(props: IntentConvictionGridProps) {
  const t = useTranslations("intents.detail.conviction");
  const tDetail = useTranslations("intents.detail.section");
  // Parity warning: effectively-equal values (within epsilon) signal the
  // thesis/execution distinction has collapsed. Skip when both are zero
  // (pristine / default state).
  const delta = Math.abs(props.thesis_conviction - props.execution_confidence);
  const parityWarn =
    delta < 0.02 &&
    !(props.thesis_conviction === 0 && props.execution_confidence === 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Cell
          label={t("thesis_conviction")}
          hint={t("thesis_conviction_hint")}
          value={props.thesis_conviction.toFixed(2)}
          warn={parityWarn}
        />
        <Cell
          label={t("execution_confidence")}
          hint={t("execution_confidence_hint")}
          value={props.execution_confidence.toFixed(2)}
          warn={parityWarn}
        />
        <Cell label={t("priority")} value={props.priority.toFixed(2)} />
        <Cell label={t("preferred_horizon")} value={props.preferred_horizon} />
      </div>
      <div className="flex items-center gap-2 border border-slate-300/70 px-3 py-2 text-xs dark:border-slate-700">
        <span className="uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t("portfolio_bucket")}
        </span>
        <span className="font-mono text-sm text-slate-900 dark:text-slate-100">
          {props.bucket}
        </span>
      </div>
    </div>
  );
}
