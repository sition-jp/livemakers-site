import { useTranslations, useFormatter } from "next-intl";
import { worstForwardReturn, type BacktestEntry } from "@/lib/pivots/types";

/**
 * Rows with fewer than this many samples are dimmed and labelled
 * "indicative only" (spec 2026-09-26 §3.5 R6 / §5.6 R6).
 */
export const LOW_SAMPLE_THRESHOLD = 5;

export function BacktestPanel({ entries }: { entries: BacktestEntry[] }) {
  const t = useTranslations("turningPoints.backtest");
  const fmt = useFormatter();

  if (entries.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">{t("empty")}</p>
    );
  }

  const pct = (n: number) =>
    fmt.number(n, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });

  return (
    <div className="space-y-3">
      <div
        className="overflow-x-auto rounded-sm border border-border-primary"
        data-testid="backtest-panel"
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-tertiary">
            <tr className="text-xs uppercase tracking-label text-text-tertiary">
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_asset")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_horizon")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_score_type")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_threshold")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_precision")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_recall")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_lead")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_avg_move")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_worst")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("col_n")}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const lowSample = e.metrics.sample_size < LOW_SAMPLE_THRESHOLD;
              return (
                <tr
                  key={`${e.asset}-${e.horizon}-${e.score_type}-${e.threshold}-${i}`}
                  className={`border-t border-border-primary/60${lowSample ? " opacity-50" : ""}`}
                  data-testid={lowSample ? "backtest-row-low-sample" : "backtest-row"}
                >
                  <th
                    scope="row"
                    className="px-4 py-3 font-medium text-text-primary"
                  >
                    {e.asset}
                  </th>
                  <td className="px-4 py-3 text-text-secondary">{e.horizon}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {e.score_type.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">≥ {e.threshold}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {pct(e.metrics.precision)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {pct(e.metrics.recall)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {e.metrics.avg_lead_time_days.toFixed(1)}d
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {pct(e.metrics.average_move)}
                  </td>
                  <td className="px-4 py-3 text-status-down">
                    {pct(worstForwardReturn(e.metrics))}
                  </td>
                  <td className="px-4 py-3 text-text-tertiary">
                    {e.metrics.sample_size}
                    {lowSample ? (
                      <span className="ml-2 text-[10px] uppercase tracking-label text-pillar-risk">
                        {t("low_sample")}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="text-xs text-text-tertiary space-y-1 px-1">
        <li>{t("explain_precision")}</li>
        <li>{t("explain_recall")}</li>
        <li>{t("explain_lead")}</li>
        <li>{t("explain_worst")}</li>
      </ul>
    </div>
  );
}
