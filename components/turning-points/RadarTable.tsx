import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { describeState, scoreDelta } from "@/lib/pivots/describe";
import type { RadarAsset, Horizon, PreviousRadar } from "@/lib/pivots/types";
import { ScoreBadge } from "./ScoreBadge";
import { formatDelta } from "./StateBlock";

const HORIZONS: Horizon[] = ["7D", "30D", "90D"];
const LEVEL_CLASS: Record<string, string> = { Low: "text-text-tertiary", Medium: "text-pillar-overview", High: "text-pillar-market", Extreme: "text-status-up" };

export function RadarTable({ assets, previous = null }: { assets: RadarAsset[]; previous?: PreviousRadar | null }) {
  const t = useTranslations("turningPoints.radar");
  const ts = useTranslations("turningPoints.state");
  if (assets.length === 0) {
    return <div data-testid="radar-empty" className="rounded-sm border border-border-primary px-6 py-12 text-center text-text-tertiary">{t("empty")}</div>;
  }
  const prevBySymbol = new Map((previous?.radar ?? []).map((a) => [a.symbol, a] as const));
  return (
    <div className="overflow-x-auto rounded-sm border border-border-primary">
      <table className="w-full text-left" data-testid="radar-table">
        <thead className="bg-bg-tertiary">
          <tr className="text-xs uppercase tracking-label text-text-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">{t("col_asset")}</th>
            {HORIZONS.map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">{t("col_horizon", { horizon: h })}</th>)}
            <th scope="col" className="px-4 py-3 font-medium">{t("col_state")}</th>
            <th scope="col" className="px-4 py-3 font-medium">{t("col_confidence")}</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const dominantHorizon = HORIZONS.reduce<Horizon>((best, h) => (asset.scores[h].overall > asset.scores[best].overall ? h : best), "30D");
            const dominant = asset.scores[dominantHorizon];
            const state = describeState({ ...dominant, main_signal: dominant.main_signal });
            const prev = prevBySymbol.get(asset.symbol);
            return (
              <tr key={asset.symbol} className="border-t border-border-primary/60 hover:bg-bg-secondary" data-testid={`radar-row-${asset.symbol}`}>
                <th scope="row" className="px-4 py-4 font-medium text-text-primary">
                  <Link href={`/turning-points/${asset.symbol.toLowerCase()}`} className="hover:underline">{asset.symbol}</Link>
                </th>
                {HORIZONS.map((h) => {
                  const delta = prev ? formatDelta(scoreDelta(asset.scores[h].overall, prev.scores[h].overall)) : null;
                  return (
                    <td key={h} className="px-4 py-4 align-top">
                      <ScoreBadge score={asset.scores[h].overall} size="md" showLevel={false} />
                      {delta !== null ? (
                        <div className="text-xs text-text-tertiary" data-testid={`radar-delta-${asset.symbol}-${h}`}>{t("col_delta")} {delta}</div>
                      ) : null}
                    </td>
                  );
                })}
                <td className="px-4 py-4 align-top text-sm" data-testid={`radar-state-${asset.symbol}`}>
                  <span className={`font-medium ${LEVEL_CLASS[state.level]}`}>{ts(`level.${state.level}.label`)}</span>
                  <span className="ml-2 text-text-secondary">{ts(`driver_short.${state.driver}`)}</span>
                  <span className="ml-1 text-xs text-text-tertiary">({dominantHorizon})</span>
                </td>
                <td className="px-4 py-4 align-top text-sm text-text-secondary">{dominant.confidence_grade}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
