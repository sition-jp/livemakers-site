import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { buildTimelineModel, TIMELINE_LAYOUT } from "@/lib/pivots/timeline";
import type { AssetSymbol, HistoryEntry, Horizon, RadarScores } from "@/lib/pivots/types";
import { TimelinePastLayer } from "./TurningPointTimeline";

export interface TimelineMiniProps {
  asset: AssetSymbol;
  /** Snapshot's generated_at date (YYYY-MM-DD). */
  today: string;
  history: HistoryEntry[] | null;
  /** Horizon the past strip/markers are read at. The list page uses 30D, the detail page's default. */
  horizon?: Horizon;
}

// The mini chart draws the past side only, so the forward windows' inputs are never read.
const UNUSED_CURRENT: RadarScores = {
  overall: 0,
  price_pivot: 0,
  volatility_pivot: 0,
  confidence_grade: "C",
  main_signal: "mixed",
};

const { priceYTop, priceYBottom, stripYBottom, pastXStart, todayX } = TIMELINE_LAYOUT;
// Crop the shared 680-wide layout to its past side (no forward windows here).
const VIEW_LEFT = pastXStart - 6;
const VIEW_WIDTH = todayX + 6 - VIEW_LEFT;
const VIEW_TOP = priceYTop - 14;
const VIEW_HEIGHT = stripYBottom + 8 - VIEW_TOP;

/** List-page (`/turning-points`) small timeline: the past panel only, linking to the asset page. */
export function TimelineMini({ asset, today, history, horizon = "30D" }: TimelineMiniProps) {
  const t = useTranslations("turningPoints.timeline");
  const model = buildTimelineModel({
    asset,
    today,
    horizon,
    currentByHorizon: { "7D": UNUSED_CURRENT, "30D": UNUSED_CURRENT, "90D": UNUSED_CURRENT },
    biasByHorizon: {},
    history,
    backtest: [],
  });

  return (
    <section data-testid={`timeline-mini-${asset}`} className="space-y-2 text-text-secondary">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-xs uppercase tracking-label text-text-tertiary">
          {t("mini_heading", { asset, h: horizon })}
        </h3>
        <Link
          href={`/turning-points/${asset.toLowerCase()}`}
          className="text-xs text-pillar-market hover:underline whitespace-nowrap"
        >
          {t("mini_link")} →
        </Link>
      </div>
      <svg
        viewBox={`${VIEW_LEFT} ${VIEW_TOP} ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={t("mini_heading", { asset, h: horizon })}
        className="w-full h-auto"
      >
        {model.past ? (
          <>
            <text x={pastXStart} y={priceYTop - 4} fontSize={10} fill="currentColor" fillOpacity={0.6} className="text-text-tertiary">
              {t("past", { days: model.past.spanDays, h: horizon })}
            </text>
            <g className="text-text-tertiary">
              <line
                x1={model.today}
                x2={model.today}
                y1={priceYTop}
                y2={stripYBottom}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeDasharray="2 3"
              />
            </g>
            <TimelinePastLayer past={model.past} t={t} />
          </>
        ) : (
          <text x={pastXStart} y={(priceYTop + priceYBottom) / 2} fontSize={11} fill="currentColor" className="text-text-tertiary">
            {t("no_history")}
          </text>
        )}
      </svg>
    </section>
  );
}
