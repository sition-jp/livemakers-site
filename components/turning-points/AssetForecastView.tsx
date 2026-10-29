import { useTranslations } from "next-intl";

import { nowCloseOf } from "@/lib/pivots/forecast-screen";
import { pickForecast } from "@/lib/pivots/forecast";
import {
  detailKey,
  type AssetSymbol,
  type BacktestEvent,
  type Horizon,
  type PivotAssetsSnapshot,
} from "@/lib/pivots/types";
import { ConfidenceGradeBadge } from "./ConfidenceGrade";
import { EvidenceList } from "./EvidenceList";
import { ForecastCards } from "./ForecastCards";
import { ForecastText } from "./ForecastText";
import { ProbabilityTimeline } from "./ProbabilityTimeline";
import { StrengthLadder } from "./StrengthLadder";

const HORIZONS: Horizon[] = ["7D", "30D", "90D"];

/** 詳細ページの新しい画面の本体 (ガイドとバナーはページ側)。呼ぶ側が hasForecastScreen を確認済みであること。 */
export function AssetForecastView({
  asset,
  snapshot,
  events,
}: {
  asset: AssetSymbol;
  snapshot: PivotAssetsSnapshot;
  events?: BacktestEvent[];
}) {
  const t = useTranslations("turningPoints.forecast");
  const td = useTranslations("turningPoints.detail");
  const items = snapshot.forecast?.[asset] ?? [];
  const history = snapshot.forecast_history?.[asset] ?? [];

  return (
    <div data-testid="asset-forecast-view" className="space-y-10">
      <StrengthLadder rows={snapshot.ladder?.[asset]} nowClose={nowCloseOf(snapshot, asset)} />
      <ForecastCards items={items} events={events} asset={asset} />
      <ForecastText items={items} trend={snapshot.trend?.[asset]} />
      <ProbabilityTimeline
        asset={asset}
        history={history}
        turns={snapshot.turns?.[asset]}
        item={pickForecast(items, "turn", "30D")}
        variant="full"
      />
      <section data-testid="score-evidence" className="space-y-6">
        <h2 className="text-sm uppercase tracking-label text-text-secondary">
          {t("evidence_heading")}
        </h2>
        {HORIZONS.map((h) => {
          const detail = snapshot.detail[detailKey(asset, h)];
          if (!detail) return null;
          return (
            <div key={h} data-testid={`score-evidence-${h}`} className="space-y-3">
              <h3 className="text-xs uppercase tracking-label text-text-tertiary">
                {t("evidence_horizon", { horizon: h })}
              </h3>
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-text-tertiary">{td("confidence_label")}</span>
                <ConfidenceGradeBadge
                  grade={detail.scores.confidence.grade}
                  score={detail.scores.confidence.score}
                />
              </div>
              <EvidenceList items={detail.evidence} />
            </div>
          );
        })}
      </section>
    </div>
  );
}
