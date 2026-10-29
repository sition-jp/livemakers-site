import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { formatPct1 } from "@/lib/pivots/forecast";
import {
  PROBABILITY_LAYOUT,
  buildProbabilityTimeline,
  type BarStatus,
} from "@/lib/pivots/probability-timeline";
import type {
  AssetSymbol,
  ForecastHistoryEntry,
  ForecastItem,
  TurnEntry,
} from "@/lib/pivots/types";

export interface ProbabilityTimelineProps {
  asset: AssetSymbol;
  history: ForecastHistoryEntry[];
  turns?: TurnEntry[];
  item: ForecastItem | null;
  variant: "full" | "mini";
}

const MINI_PAST_DAYS = 60;

// Colours follow the site tokens (dark theme aware) via currentColor.
const STATUS_CLASS: Record<BarStatus, string> = {
  hit: "text-status-live",
  miss: "text-text-tertiary",
  pending: "text-pillar-overview",
  today: "text-pillar-projects",
};
const STATUS_OPACITY: Record<BarStatus, number> = {
  hit: 1,
  miss: 0.5,
  pending: 0.45,
  today: 1,
};

export function ProbabilityTimeline({
  asset,
  history,
  turns = [],
  item,
  variant,
}: ProbabilityTimelineProps) {
  const t = useTranslations("turningPoints.probability");
  const L = PROBABILITY_LAYOUT;
  const full = variant === "full";
  const event = item?.event ?? "turn";
  const horizon = item?.horizon ?? "30D";
  const model = buildProbabilityTimeline({
    history,
    turns,
    event,
    horizon,
    todayPct: item?.today_pct ?? null,
    usualPct: item?.usual_pct ?? null,
    pastDays: full ? undefined : MINI_PAST_DAYS,
  });
  const hatchId = `pt-hatch-${asset}-${variant}`;
  const testId = full ? `probability-full-${asset}` : `probability-mini-${asset}`;

  if (history.length === 0) {
    return (
      <section data-testid={testId} className="space-y-1">
        {!full ? (
          <p className="text-sm font-medium text-text-primary">{t("mini_heading", { asset })}</p>
        ) : null}
        <p className="text-xs text-text-tertiary">{t("no_data")}</p>
      </section>
    );
  }

  const count = (s: BarStatus) => model.bars.filter((b) => b.status === s).length;
  const aria = t("aria", {
    asset,
    n: model.bars.length + model.gaps.length,
    hit: count("hit"),
    miss: count("miss"),
    pending: count("pending"),
  });
  const futureDays = Math.round(
    (Date.parse(`${model.future.endDate}T00:00:00Z`) -
      Date.parse(`${history[history.length - 1].date}T00:00:00Z`)) /
      86400000,
  );

  // Consecutive gap days form one run; the label sits over the run's centre.
  const gapRuns: { x: number }[] = [];
  {
    let run: number[] = [];
    let prev: string | null = null;
    const flush = () => {
      if (run.length) gapRuns.push({ x: (run[0] + run[run.length - 1]) / 2 });
      run = [];
    };
    for (const g of model.gaps) {
      if (prev !== null) {
        const d = Math.round(
          (Date.parse(`${g.date}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`)) / 86400000,
        );
        if (d !== 1) flush();
      }
      run.push(g.x);
      prev = g.date;
    }
    flush();
  }

  const svg = (
    <svg
      viewBox={`0 0 ${L.width} ${L.height}`}
      role="img"
      aria-label={aria}
      className="w-full h-auto"
    >
      <defs>
        <pattern id={hatchId} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)" className="text-text-primary">
          <line x1={0} y1={0} x2={0} y2={4} stroke="currentColor" strokeWidth={1.5} />
        </pattern>
      </defs>

      <g className="text-pillar-projects" data-testid="probability-future">
        <rect
          x={model.future.x0}
          y={20}
          width={Math.max(model.future.x1 - model.future.x0, 0)}
          height={L.barBottom - 20}
          fill="currentColor"
          fillOpacity={0.12}
        />
        {full ? (
          <>
            <text x={model.future.x0 + 8} y={34} fontSize={12} fill="currentColor">
              {t("future", { days: futureDays })}
            </text>
            {model.future.todayPct !== null ? (
              <text x={model.future.x0 + 8} y={52} fontSize={22} fontWeight={600} fill="currentColor">
                {formatPct1(model.future.todayPct)}%
              </text>
            ) : null}
          </>
        ) : null}
      </g>
      {full && model.future.usualPct !== null ? (
        <text
          x={model.future.x0 + 8}
          y={70}
          fontSize={11}
          fill="currentColor"
          className="text-text-tertiary"
        >
          {t("usual", { pct: formatPct1(model.future.usualPct) })}
        </text>
      ) : null}

      <g className="text-text-tertiary">
        {model.ticks.map((tk) => (
          <g key={tk.date} data-testid="probability-tick">
            <line x1={tk.x} x2={tk.x} y1={L.barTop} y2={L.barBottom} stroke="currentColor" strokeOpacity={0.25} />
            {full ? (
              <text x={tk.x} y={L.tickY} fontSize={10} textAnchor="middle" fill="currentColor">
                {tk.label}
              </text>
            ) : null}
          </g>
        ))}
      </g>

      {model.bars.map((b) => (
        <g key={b.date} className={STATUS_CLASS[b.status]}>
          <rect
            data-testid="probability-bar"
            data-date={b.date}
            data-status={b.status}
            data-backfilled={b.backfilled ? "true" : undefined}
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            fill="currentColor"
            fillOpacity={STATUS_OPACITY[b.status]}
          />
          {b.backfilled ? (
            <g opacity={0.35}>
              <rect
                data-testid="probability-hatch"
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                fill={`url(#${hatchId})`}
              />
            </g>
          ) : null}
        </g>
      ))}

      {full
        ? gapRuns.map((g, i) => (
            <text
              key={i}
              data-testid="probability-gap-label"
              x={g.x}
              y={L.barBottom - 6}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
              className="text-text-tertiary"
            >
              {t("gap")}
            </text>
          ))
        : null}

      {model.usualY !== null ? (
        <g className="text-text-tertiary">
          <line
            data-testid="probability-usual-line"
            x1={L.left}
            x2={L.right}
            y1={model.usualY}
            y2={model.usualY}
            stroke="currentColor"
            strokeDasharray="4 3"
          />
        </g>
      ) : null}

      {model.price ? (
        <g className="text-text-secondary">
          <polyline
            data-testid="probability-price"
            points={model.price.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          />
        </g>
      ) : null}

      {model.markers.map((m) => (
        <text
          key={`${m.date}-${m.kind}`}
          data-testid="probability-marker"
          data-kind={m.kind}
          x={m.x}
          y={m.y}
          fontSize={m.size}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          className={m.kind === "top" ? "text-pillar-risk" : "text-status-live"}
        >
          {m.kind === "top" ? "▼" : "▲"}
        </text>
      ))}

      <g className="text-pillar-projects">
        <line
          data-testid="probability-today-line"
          x1={model.todayX}
          x2={model.todayX}
          y1={20}
          y2={L.barBottom + 4}
          stroke="currentColor"
          strokeWidth={2}
        />
        {full ? (
          <text x={model.todayX} y={L.barBottom + 18} fontSize={12} fontWeight={600} textAnchor="middle" fill="currentColor">
            {t("today")}
          </text>
        ) : null}
      </g>
    </svg>
  );

  if (!full) {
    return (
      <section data-testid={testId} className="space-y-1 text-text-secondary">
        <p className="text-sm font-medium text-text-primary">{t("mini_heading", { asset })}</p>
        {svg}
        <Link
          href={`/turning-points/${asset.toLowerCase()}`}
          className="text-xs text-pillar-market hover:underline whitespace-nowrap"
        >
          {t("mini_link")} →
        </Link>
      </section>
    );
  }

  const swatch = (cls: string, opacity: number, label: string, key: string) => (
    <span key={key} className="inline-flex items-center gap-1.5" data-testid={`probability-legend-${key}`}>
      <span className={cls}>
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-current" style={{ opacity }} />
      </span>
      {label}
    </span>
  );

  return (
    <section data-testid={testId} className="space-y-2 text-text-secondary">
      <h3 className="text-sm font-semibold text-text-primary">{t("heading")}</h3>
      <p className="text-xs text-text-tertiary">{t("notes", { days: futureDays })}</p>
      <p data-testid="probability-price-caption" className="text-xs text-text-tertiary">
        {t("price")}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {swatch(STATUS_CLASS.hit, 1, t("legend_hit"), "hit")}
        {swatch(STATUS_CLASS.miss, STATUS_OPACITY.miss, t("legend_miss"), "miss")}
        {swatch(STATUS_CLASS.pending, STATUS_OPACITY.pending, t("legend_pending"), "pending")}
        {swatch(STATUS_CLASS.today, 1, t("legend_today"), "today")}
        <span className="inline-flex items-center gap-1.5" data-testid="probability-legend-top">
          <span className="text-pillar-risk">▼</span>
          {t("top")}
        </span>
        <span className="inline-flex items-center gap-1.5" data-testid="probability-legend-bottom">
          <span className="text-status-live">▲</span>
          {t("bottom")}
        </span>
        <span data-testid="probability-legend-backfilled">{t("legend_backfilled")}</span>
      </div>
      {svg}
    </section>
  );
}
