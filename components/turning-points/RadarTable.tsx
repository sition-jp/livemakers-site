import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { RadarAsset, Horizon } from "@/lib/pivots/types";
import { ScoreBadge } from "./ScoreBadge";

const HORIZONS: Horizon[] = ["7D", "30D", "90D"];

export function RadarTable({ assets }: { assets: RadarAsset[] }) {
  const t = useTranslations("turningPoints.radar");

  if (assets.length === 0) {
    return (
      <div
        data-testid="radar-empty"
        className="rounded-sm border border-border-primary px-6 py-12 text-center text-text-tertiary"
      >
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-border-primary">
      <table className="w-full text-left" data-testid="radar-table">
        <thead className="bg-bg-tertiary">
          <tr className="text-xs uppercase tracking-label text-text-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              {t("col_asset")}
            </th>
            {HORIZONS.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-3 font-medium whitespace-nowrap"
              >
                {t("col_horizon", { horizon: h })}
              </th>
            ))}
            <th scope="col" className="px-4 py-3 font-medium">
              {t("col_main_signal")}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("col_confidence")}
            </th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const dominantHorizon = HORIZONS.reduce<Horizon>(
              (best, h) =>
                asset.scores[h].overall > asset.scores[best].overall ? h : best,
              "30D",
            );
            const dominant = asset.scores[dominantHorizon];
            return (
              <tr
                key={asset.symbol}
                className="border-t border-border-primary/60 hover:bg-bg-secondary"
                data-testid={`radar-row-${asset.symbol}`}
              >
                <th
                  scope="row"
                  className="px-4 py-4 font-medium text-text-primary"
                >
                  <Link
                    href={`/turning-points/${asset.symbol.toLowerCase()}`}
                    className="hover:underline"
                  >
                    {asset.symbol}
                  </Link>
                </th>
                {HORIZONS.map((h) => (
                  <td key={h} className="px-4 py-4 align-top">
                    <ScoreBadge
                      score={asset.scores[h].overall}
                      size="md"
                      showLevel
                    />
                  </td>
                ))}
                <td className="px-4 py-4 align-top text-sm text-text-secondary uppercase tracking-label">
                  {t(`signal_${dominant.main_signal}`)}
                </td>
                <td className="px-4 py-4 align-top text-sm text-text-secondary">
                  {dominant.confidence_grade}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
