import { useTranslations } from "next-intl";
import type { DataProvenance } from "@/lib/pivots/types";

/**
 * Backtest data-provenance notice (spec 2026-09-26 §3.5 R6 / §5.6 R6).
 *
 * Replaces the old always-provisional banner: once the producer publishes
 * `data_provenance` on the backtest snapshot (real OI/funding history from
 * the runner cutover), this shows the source/coverage instead of the
 * "still a proxy" notice.
 */
export function BacktestProvenanceBanner({
  provenance,
}: {
  provenance: DataProvenance | null;
}) {
  const t = useTranslations("turningPoints.backtest");
  const real = provenance !== null;
  return (
    <aside
      role="note"
      data-testid={real ? "backtest-provenance" : "backtest-provisional"}
      className={`rounded-sm border px-4 py-3 text-xs leading-relaxed text-text-secondary ${
        real
          ? "border-status-up/40 bg-status-up/10"
          : "border-pillar-risk/40 bg-pillar-risk/10"
      }`}
    >
      {real
        ? t("provenance", {
            source: provenance.source,
            start: provenance.start,
            end: provenance.end,
            coverage: provenance.coverage_pct,
          })
        : t("provenance_missing")}
    </aside>
  );
}
