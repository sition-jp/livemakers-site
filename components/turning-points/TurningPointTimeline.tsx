import { useTranslations } from "next-intl";

import { buildTimelineModel, TIMELINE_LAYOUT, type TimelinePast, type TimelineWindow } from "@/lib/pivots/timeline";
import type {
  AssetSymbol,
  BacktestEntry,
  DirectionBias,
  HistoryEntry,
  Horizon,
  RadarScores,
} from "@/lib/pivots/types";

export interface TurningPointTimelineProps {
  asset: AssetSymbol;
  horizon: Horizon;
  /** Snapshot's generated_at date (YYYY-MM-DD) — keeps the chart deterministic per snapshot. */
  today: string;
  /** Each horizon's own current scores (T2) — the radar entry's full `scores` map. */
  currentByHorizon?: Record<Horizon, RadarScores> | null;
  /** Each horizon's own direction bias (T2) — that horizon's detail entry's `direction_bias`. */
  biasByHorizon?: Partial<Record<Horizon, DirectionBias | null>> | null;
  history: HistoryEntry[] | null;
  backtest: BacktestEntry[];
}

// Scores are unavailable for this asset/horizon (radar entry missing). The
// windows still render, but at the quiet floor rather than guessing a level.
const NEUTRAL_CURRENT: RadarScores = {
  overall: 0,
  price_pivot: 0,
  volatility_pivot: 0,
  confidence_grade: "C",
  main_signal: "mixed",
};
const NEUTRAL_CURRENT_BY_HORIZON: Record<Horizon, RadarScores> = {
  "7D": NEUTRAL_CURRENT,
  "30D": NEUTRAL_CURRENT,
  "90D": NEUTRAL_CURRENT,
};

/** Typographic minus (matches StateBlock.formatDelta / house style). */
function formatMovePercent(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return "±0%";
  return rounded > 0 ? `+${rounded}%` : `−${Math.abs(rounded)}%`;
}

const {
  pastXStart,
  priceYTop,
  priceYBottom,
  stripYTop,
  stripYBottom,
  windowYStart,
  windowHeight,
  windowPitch,
  legendY,
  viewBoxHeight,
  baseWidth,
} = TIMELINE_LAYOUT;

export function TurningPointTimeline({
  asset,
  horizon,
  today,
  currentByHorizon,
  biasByHorizon,
  history,
  backtest,
}: TurningPointTimelineProps) {
  const t = useTranslations("turningPoints.timeline");
  const model = buildTimelineModel({
    asset,
    today,
    horizon,
    currentByHorizon: currentByHorizon ?? NEUTRAL_CURRENT_BY_HORIZON,
    biasByHorizon: biasByHorizon ?? {},
    history,
    backtest,
  });

  return (
    <section data-testid="turning-point-timeline" className="space-y-3 text-text-secondary">
      <h2 className="text-xs uppercase tracking-label text-text-tertiary">{t("heading")}</h2>
      <svg
        viewBox={`0 0 ${baseWidth} ${viewBoxHeight}`}
        role="img"
        aria-label={t("heading")}
        className="w-full h-auto"
      >
        <title>{t("heading")}</title>
        <desc>{t("note")}</desc>

        <defs>
          <marker id="tp-timeline-arrow" markerWidth={7} markerHeight={7} refX={6} refY={3.5} orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" />
          </marker>
        </defs>

        {/* today divider */}
        <g className="text-text-tertiary">
          <line
            x1={model.today}
            x2={model.today}
            y1={32}
            y2={windowYStart + 2 * windowPitch + windowHeight}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeDasharray="2 3"
          />
        </g>

        {model.past ? (
          <text
            data-testid="timeline-past-label"
            x={pastXStart}
            y={40}
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.6}
            className="text-text-tertiary"
          >
            {t("past", { days: model.past.spanDays, h: horizon })}
          </text>
        ) : null}
        <text x={model.today + 8} y={40} fontSize={10} fill="currentColor" fillOpacity={0.6} className="text-text-tertiary">
          {t("future")}
        </text>

        {model.past ? (
          <g data-testid="timeline-past">
            <TimelinePastLayer past={model.past} t={t} />
            {model.past.example ? (
              <g data-testid="timeline-example" className="text-text-secondary">
                <line
                  x1={model.past.example.fromX}
                  x2={model.past.example.toX}
                  y1={model.past.example.y}
                  y2={model.past.example.y}
                  stroke="currentColor"
                  strokeOpacity={0.8}
                  strokeWidth={1}
                  markerEnd="url(#tp-timeline-arrow)"
                />
                {/* On the date axis the arrow can be shorter than its label: hang the label off the
                    end nearer the middle so it never runs past the chart edge. */}
                <text
                  x={
                    model.past.example.fromX < (pastXStart + model.today) / 2
                      ? model.past.example.fromX
                      : model.past.example.toX
                  }
                  y={model.past.example.y - 6}
                  fontSize={9}
                  textAnchor={model.past.example.fromX < (pastXStart + model.today) / 2 ? "start" : "end"}
                  fill="currentColor"
                >
                  {t("example", {
                    date: model.past.example.date,
                    score: model.past.example.score,
                    days: model.past.example.days,
                    move: formatMovePercent(model.past.example.movePct),
                  })}
                </text>
              </g>
            ) : null}
          </g>
        ) : (
          <text
            x={pastXStart}
            y={(priceYTop + priceYBottom) / 2}
            fontSize={11}
            fill="currentColor"
            className="text-text-tertiary"
          >
            {t("no_history")}
          </text>
        )}

        <text
          x={model.today - 8}
          y={windowYStart - 6}
          fontSize={9}
          textAnchor="end"
          fill="currentColor"
          className="text-text-tertiary"
        >
          {t("lead_caption")}
        </text>
        {model.windows.map((w, i) => (
          <TimelineWindowRow key={w.horizon} window={w} rowIndex={i} t={t} />
        ))}

        {/* legend */}
        <g className="text-text-tertiary" fontSize={9}>
          <circle cx={pastXStart + 4} cy={legendY} r={2} fill="none" stroke="currentColor" strokeWidth={1} />
          <text x={pastXStart + 12} y={legendY + 3} fill="currentColor">
            {t("legend_marker")}
          </text>

          <circle cx={pastXStart + 190} cy={legendY} r={3.5} fill="currentColor" className="text-status-up" />
          <text x={pastXStart + 200} y={legendY + 3} fill="currentColor">
            {t("legend_strong")}
          </text>

          <rect x={pastXStart + 380} y={legendY - 5} width={10} height={10} fill="currentColor" fillOpacity={0.5} className="text-pillar-market" />
          <text x={pastXStart + 394} y={legendY + 3} fill="currentColor">
            {t("legend_strip")}
          </text>
        </g>
      </svg>
      <p className="text-xs text-text-tertiary">{t("note")}</p>
    </section>
  );
}

function TimelineWindowRow({
  window: w,
  rowIndex,
  t,
}: {
  window: TimelineWindow;
  rowIndex: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const y = windowYStart + rowIndex * windowPitch;

  return (
    <g data-testid={`timeline-window-${w.horizon}`}>
      <title>{t("window", { h: w.horizon })}</title>
      <rect
        x={w.x}
        y={y}
        width={w.width}
        height={windowHeight}
        fill="currentColor"
        fillOpacity={w.opacity}
        stroke="currentColor"
        strokeOpacity={0.4}
        strokeWidth={1}
        className="text-pillar-market"
      />
      <text x={w.x + 6} y={y + 13} fontSize={10} fill="currentColor" className="text-text-primary">
        {t("window", { h: w.horizon })}
      </text>

      {/* The lean arrow is no longer drawn (10/17): `w.lean` stays in the model as internal data. */}
      <text
        data-testid={`timeline-lead-${w.horizon}`}
        x={w.x - 8}
        y={y + windowHeight / 2 + 3}
        fontSize={9}
        textAnchor="end"
        fill="currentColor"
        className="text-text-secondary"
      >
        {w.ticks.length === 0
          ? t("lead_none")
          : w.ticks
              .map((tick) =>
                t(tick.weak ? "lead_item_weak" : "lead_item", {
                  type: t(tick.scoreType === "price_pivot" ? "lead_type_price" : "lead_type_volatility"),
                  days: Math.round(tick.days),
                  n: tick.n,
                }),
              )
              .join(" / ")}
      </text>

      {w.ticks.map((tick, i) => (
        <g key={`${w.horizon}-tick-${i}`} className="text-text-secondary">
          <line
            x1={tick.x}
            x2={tick.x}
            y1={y + windowHeight - 4}
            y2={y + windowHeight + 4}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray={tick.weak ? "1.5 1.5" : undefined}
          >
            {/* One string child: a <title> with several children breaks hydration. */}
            <title>{`${t("lead", { days: Math.round(tick.days), n: tick.n })}${tick.weak ? ` · ${t("lead_weak")}` : ""}`}</title>
          </line>
        </g>
      ))}
    </g>
  );
}

/**
 * Past-side drawing shared by the asset page and the list page (TimelineMini):
 * date-proportional price line split at missing records, the "no records"
 * bands, the score strip and the >= 40 / >= 70 markers.
 */
export function TimelinePastLayer({
  past,
  t,
}: {
  past: TimelinePast;
  t: ReturnType<typeof useTranslations>;
}) {
  const stripCellWidth = Math.max(1.5, past.dayWidth - 0.5);
  return (
    <>
      {past.gaps.map((gap, i) => (
        <g key={`gap-${i}`} data-testid={`timeline-gap-${i}`} className="text-text-tertiary">
          <title>{`${t("gap")} ${gap.from} → ${gap.to}`}</title>
          <rect
            x={gap.x1}
            y={priceYTop}
            width={gap.x2 - gap.x1}
            height={stripYBottom - priceYTop}
            fill="currentColor"
            fillOpacity={0.06}
          />
          {gap.x2 - gap.x1 > 36 ? (
            <text
              x={(gap.x1 + gap.x2) / 2}
              y={(priceYTop + priceYBottom) / 2}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
            >
              {t("gap")}
            </text>
          ) : null}
        </g>
      ))}
      {past.segments.map((segment, i) => (
        <polyline
          key={`segment-${i}`}
          points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-pillar-market"
        />
      ))}
      {past.strip.map((cell, i) => (
        <rect
          key={`strip-${i}`}
          x={cell.x - stripCellWidth / 2}
          y={stripYTop}
          width={stripCellWidth}
          height={stripYBottom - stripYTop}
          fill="currentColor"
          fillOpacity={cell.opacity}
          className="text-pillar-market"
        />
      ))}
      {past.markers.map((m, i) => (
        <circle
          key={`marker-${i}`}
          cx={m.x}
          cy={m.y}
          r={m.strong ? 3.5 : 2}
          fill={m.strong ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1}
          className={m.strong ? "text-status-up" : "text-text-secondary"}
        >
          <title>{m.date}</title>
        </circle>
      ))}
    </>
  );
}
