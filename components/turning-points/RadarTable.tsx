import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { describeState, scoreDelta } from "@/lib/pivots/describe";
import { QUESTIONS, forecastLevel, formatSignedPct, pickForecast, type Level } from "@/lib/pivots/forecast";
import type { AssetSymbol, ForecastItem, RadarAsset, Horizon, PreviousRadar } from "@/lib/pivots/types";
import { ScoreBadge } from "./ScoreBadge";
import { formatDelta } from "./StateBlock";

const HORIZONS: Horizon[] = ["7D", "30D", "90D"];
const LEVEL_CLASS: Record<string, string> = { Low: "text-text-tertiary", Medium: "text-pillar-overview", High: "text-pillar-market", Extreme: "text-status-up" };

const FORECAST_LEVEL_CLASS: Record<Level, string> = { above: "text-pillar-market", usual: "text-text-secondary", below: "text-text-tertiary" };

function fmt1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function RadarTable({
  assets,
  previous = null,
  forecast,
}: {
  assets: RadarAsset[];
  previous?: PreviousRadar | null;
  /** 渡すと確率の列 (資産 + 4 つの問い) を出す。渡さなければ今のスコアの表。 */
  forecast?: Partial<Record<AssetSymbol, ForecastItem[]>>;
}) {
  const t = useTranslations("turningPoints.radar");
  const ts = useTranslations("turningPoints.state");
  const tf = useTranslations("turningPoints.forecast");
  if (assets.length === 0) {
    return <div data-testid="radar-empty" className="rounded-sm border border-border-primary px-6 py-12 text-center text-text-tertiary">{t("empty")}</div>;
  }
  if (forecast) {
    return (
      <div className="overflow-x-auto rounded-sm border border-border-primary">
        <table className="w-full text-left" data-testid="radar-table">
          <thead className="bg-bg-tertiary">
            <tr className="text-xs uppercase tracking-label text-text-tertiary">
              <th scope="col" className="px-4 py-3 font-medium">{t("col_asset")}</th>
              {QUESTIONS.map((q) => (
                <th key={q.id} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">{tf(`question_short.${q.id}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.symbol} className="border-t border-border-primary/60 hover:bg-bg-secondary" data-testid={`radar-row-${asset.symbol}`}>
                <th scope="row" className="px-4 py-4 font-medium text-text-primary">
                  <Link href={`/turning-points/${asset.symbol.toLowerCase()}`} className="hover:underline">{asset.symbol}</Link>
                </th>
                {QUESTIONS.map((q) => {
                  const item = pickForecast(forecast[asset.symbol], q.event, q.horizon);
                  if (!item) return <td key={q.id} className="px-4 py-4 align-top text-text-tertiary" data-testid={`radar-forecast-${asset.symbol}-${q.id}`}>—</td>;
                  const level = forecastLevel(item.today_pct, item.usual_pct);
                  const delta = item.prev_today_pct !== undefined ? Math.round((item.today_pct - item.prev_today_pct) * 10) / 10 : null;
                  return (
                    <td key={q.id} className="px-4 py-4 align-top" data-testid={`radar-forecast-${asset.symbol}-${q.id}`}>
                      <div className={`text-lg font-medium ${FORECAST_LEVEL_CLASS[level]}`}>{fmt1(item.today_pct)}%</div>
                      <div className="text-xs text-text-secondary">{tf("usual_pct", { pct: fmt1(item.usual_pct) })}</div>
                      {delta !== null ? (
                        <div className="text-xs text-text-tertiary">{tf("prev", { delta: formatSignedPct(delta) })}</div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
