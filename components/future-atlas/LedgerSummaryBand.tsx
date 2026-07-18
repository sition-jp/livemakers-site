import { useTranslations } from "next-intl";

import type { LedgerSummary } from "@/lib/future-atlas/snapshot";

const COUNTS: Array<{ key: "total" | "open" | "overdue" | "true" | "false" | "indeterminate" | "void" | "withdrawn"; value: (summary: LedgerSummary) => number }> = [
  { key: "total", value: (summary) => summary.total },
  { key: "open", value: (summary) => summary.open },
  { key: "overdue", value: (summary) => summary.overdue },
  { key: "true", value: (summary) => summary.trueCount },
  { key: "false", value: (summary) => summary.falseCount },
  { key: "indeterminate", value: (summary) => summary.indeterminate },
  { key: "void", value: (summary) => summary.voidCount },
  { key: "withdrawn", value: (summary) => summary.withdrawn },
];

export function LedgerSummaryBand({ summary }: { summary: LedgerSummary }) {
  const t = useTranslations("futureAtlas.summary");

  return (
    <section aria-label={t("ariaLabel")}>
      <div data-atlas-counts className="grid gap-px overflow-hidden border border-border-primary bg-border-primary sm:grid-cols-4 lg:grid-cols-8">
        {COUNTS.map(({ key, value }) => (
          <div key={key} className="bg-bg-primary px-3 py-3">
            <p className="text-[10px] font-medium tracking-label text-text-tertiary">{t(key)}</p>
            <p data-atlas-count={key} className="mt-1 font-mono text-lg text-text-primary">{value(summary)}</p>
          </div>
        ))}
      </div>
      {(summary.hitRate !== null || summary.nonBinaryResolutionRate !== null) && (
        <div data-atlas-ratios className="mt-px grid gap-px overflow-hidden border border-border-primary bg-border-primary sm:grid-flow-col sm:auto-cols-fr">
          {summary.hitRate !== null && (
            <p
              data-atlas-hit-rate={`${Math.round(summary.hitRate * 100)}%`}
              className="bg-bg-primary px-3 py-3 text-sm font-semibold text-text-primary"
            >
              {t("hitRate")} {Math.round(summary.hitRate * 100)}%
            </p>
          )}
          {summary.nonBinaryResolutionRate !== null && (
            <p
              data-atlas-non-binary-resolution-rate={`${Math.round(summary.nonBinaryResolutionRate * 100)}%`}
              className="bg-bg-primary px-3 py-3 text-sm font-semibold text-text-primary"
            >
              {t("nonBinaryResolutionRate")} {Math.round(summary.nonBinaryResolutionRate * 100)}%
            </p>
          )}
        </div>
      )}
    </section>
  );
}
