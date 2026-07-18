import type { LedgerSummary } from "@/lib/future-atlas/snapshot";

const COUNTS: Array<{ key: string; label: string; value: (summary: LedgerSummary) => number }> = [
  { key: "total", label: "総数", value: (summary) => summary.total },
  { key: "open", label: "判定待ち", value: (summary) => summary.open },
  { key: "overdue", label: "期限超過", value: (summary) => summary.overdue },
  { key: "true", label: "的中", value: (summary) => summary.trueCount },
  { key: "false", label: "外れ", value: (summary) => summary.falseCount },
  { key: "indeterminate", label: "判定不能", value: (summary) => summary.indeterminate },
  { key: "void", label: "無効", value: (summary) => summary.voidCount },
  { key: "withdrawn", label: "撤回", value: (summary) => summary.withdrawn },
];

export function LedgerSummaryBand({ summary }: { summary: LedgerSummary }) {
  return (
    <section aria-label="未来アトラス集計" className="grid gap-px overflow-hidden border border-border-primary bg-border-primary sm:grid-cols-4 lg:grid-cols-8">
      {COUNTS.map(({ key, label, value }) => (
        <div key={key} className="bg-bg-primary px-3 py-3">
          <p className="text-[10px] font-medium tracking-label text-text-tertiary">{label}</p>
          <p data-atlas-count={key} className="mt-1 font-mono text-lg text-text-primary">{value(summary)}</p>
        </div>
      ))}
      {summary.hitRate !== null && (
        <p
          data-atlas-hit-rate={`${Math.round(summary.hitRate * 100)}%`}
          className="bg-bg-primary px-3 py-3 text-sm font-semibold text-text-primary"
        >
          的中率 {Math.round(summary.hitRate * 100)}%
        </p>
      )}
    </section>
  );
}
