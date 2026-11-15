import { useTranslations } from "next-intl";

import { ScopedIntlProvider } from "@/components/i18n/ScopedIntlProvider";
import { hasV2Screen, nowCloseOf } from "@/lib/pivots/forecast-screen";
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
import { RangeBandChart } from "./RangeBandChart";
import { RegimeHeadline } from "./RegimeHeadline";
import { TurnCards } from "./TurnCards";
import { WhatIsThis } from "./WhatIsThis";
import { WhatItDoesNotTell } from "./WhatItDoesNotTell";
import { WorkedExample } from "./WorkedExample";
import { StrengthLadder } from "./StrengthLadder";

const HORIZONS: Horizon[] = ["7D", "30D", "90D"];
const V2_HORIZONS: Horizon[] = ["7D", "30D"];

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
  // v2 の並びは regime と range_band が両方ある資産だけ。片方でも欠ければ今の画面のまま (壊さない)
  const v2 = hasV2Screen(snapshot, asset);
  const regime = snapshot.regime?.[asset];
  const band = snapshot.range_band?.[asset];
  const closes = history.flatMap((h) => (typeof h.close === "number" ? [{ date: h.date, close: h.close }] : []));
  const horizons = v2 ? V2_HORIZONS : HORIZONS;

  return (
    <div data-testid="asset-forecast-view" data-layout={v2 ? "v2" : "legacy"} className="space-y-10">
      {v2 ? (
        <>
          <ScopedIntlProvider scope="turningPoints">
            <RegimeHeadline asset={asset} regime={regime} />
          </ScopedIntlProvider>
          <RangeBandChart asset={asset} band={band} history={closes} />
          <WhatIsThis />
          <WorkedExample asset={asset} band={band} />
          <TurnCards
            asset={asset}
            forecast={items}
            ladder={snapshot.ladder?.[asset]}
            turnRate={snapshot.turn_rate?.[asset]}
            band={band}
          />
          <WhatItDoesNotTell band={band} />
          <StrengthLadder rows={snapshot.ladder?.[asset]} nowClose={nowCloseOf(snapshot, asset)} />
        </>
      ) : (
        <>
          <StrengthLadder rows={snapshot.ladder?.[asset]} nowClose={nowCloseOf(snapshot, asset)} />
          <ForecastCards items={items} events={events} asset={asset} />
          <ForecastText items={items} trend={snapshot.trend?.[asset]} />
        </>
      )}
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
        {horizons.map((h) => {
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
