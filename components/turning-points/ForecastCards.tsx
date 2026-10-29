import { useTranslations } from "next-intl";

import {
  QUESTIONS,
  forecastLevel,
  formatSignedPct,
  pickForecast,
  type Level,
} from "@/lib/pivots/forecast";
import type { AssetSymbol, BacktestEvent, ForecastItem } from "@/lib/pivots/types";

export interface ForecastCardsProps {
  items: ForecastItem[];
  events?: BacktestEvent[];
  asset: AssetSymbol;
}

const LEVEL_CLASS: Record<Level, string> = {
  above: "text-pillar-market",
  usual: "text-text-secondary",
  below: "text-text-tertiary",
};

const GAP_NOTE_PTS = 20;

function fmt1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function ForecastCards({ items, events, asset }: ForecastCardsProps) {
  const t = useTranslations("turningPoints.forecast");

  return (
    <div data-testid="forecast-cards" className="grid gap-3 sm:grid-cols-2">
      {QUESTIONS.map((q) => {
        const item = pickForecast(items, q.event, q.horizon);
        if (!item) return null;
        const level = forecastLevel(item.today_pct, item.usual_pct);
        const gap = Math.round((item.today_pct - item.usual_pct) * 10) / 10;
        const delta =
          item.prev_today_pct !== undefined
            ? Math.round((item.today_pct - item.prev_today_pct) * 10) / 10
            : null;
        const ev =
          q.horizon === "90D"
            ? events?.find((e) => e.asset === asset && e.event === q.event && e.horizon === q.horizon)
            : undefined;
        const rate = ev?.holdout.holdout_rate_pct;
        const showGap =
          typeof rate === "number" && Math.abs(rate - ev!.usual_pct) >= GAP_NOTE_PTS;
        const badge = q.role === "main" ? "main" : q.role === "reference" ? "reference" : null;
        return (
          <article
            key={q.id}
            data-testid={`forecast-card-${q.id}`}
            className="space-y-2 rounded border border-border-primary p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-text-primary">{t(`question.${q.id}`)}</p>
              {badge ? (
                <span className="shrink-0 text-xs text-text-tertiary">{t(`role.${badge}`)}</span>
              ) : null}
            </div>
            <p className={`text-3xl font-medium ${LEVEL_CLASS[level]}`}>
              {t("today_pct", { pct: fmt1(item.today_pct) })}
            </p>
            <p className="text-sm text-text-secondary">
              {t("usual_pct", { pct: fmt1(item.usual_pct) })}
              <span className="ml-2">{t("gap", { gap: formatSignedPct(gap) })}</span>
            </p>
            <p className={`text-sm ${LEVEL_CLASS[level]}`}>{t(`level.${level}`)}</p>
            {delta !== null ? (
              <p data-testid={`forecast-prev-${q.id}`} className="text-xs text-text-tertiary">
                {delta > 0 ? "▲ " : delta < 0 ? "▼ " : ""}
                {t("prev", { delta: formatSignedPct(delta) })}
              </p>
            ) : null}
            <div aria-hidden="true" className="space-y-1">
              <div className="h-1.5 w-full rounded bg-border-primary/40">
                <div
                  className="h-1.5 rounded bg-pillar-market"
                  style={{ width: `${item.today_pct}%` }}
                />
              </div>
              <div className="h-1.5 w-full rounded bg-border-primary/40">
                <div
                  className="h-1.5 rounded bg-text-tertiary"
                  style={{ width: `${item.usual_pct}%` }}
                />
              </div>
            </div>
            {q.horizon === "90D" ? (
              <div className="space-y-1 text-xs text-text-tertiary">
                <p data-testid={`forecast-note90-${q.id}`}>{t("note90")}</p>
                {showGap ? (
                  <p data-testid={`forecast-note90-gap-${q.id}`}>
                    {t("note90_gap", { rate: fmt1(rate as number), usual: fmt1(ev!.usual_pct) })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
