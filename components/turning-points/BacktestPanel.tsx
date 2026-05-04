import { useTranslations, useFormatter } from "next-intl";
import type { BacktestEntry } from "@/lib/pivots/types";

export function BacktestPanel({ entries }: { entries: BacktestEntry[] }) {
  const t = useTranslations("turningPoints.backtest");
  const fmt = useFormatter();

  if (entries.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">{t("empty")}</p>
    );
  }

  const pct = (n: number) => fmt.number(n, { style: "percent", maximumFractionDigits: 1 });

  return (
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
              {t("col_max_dd")}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("col_n")}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr
              key={`${e.asset}-${e.horizon}-${e.score_type}-${e.threshold}-${i}`}
              className="border-t border-border-primary/60"
              data-testid="backtest-row"
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
                {pct(e.metrics.max_drawdown)}
              </td>
              <td className="px-4 py-3 text-text-tertiary">
                {e.metrics.sample_size}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
