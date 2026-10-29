import { useLocale, useTranslations } from "next-intl";

import { forecastLevel, forecastLines, pickForecast, trendLine } from "@/lib/pivots/forecast";
import type { ForecastItem } from "@/lib/pivots/types";

export interface ForecastTextProps {
  items: ForecastItem[];
  trend?: { ret_30d_pct?: number; ret_90d_pct?: number };
}

export function ForecastText({ items, trend }: ForecastTextProps) {
  const t = useTranslations("turningPoints.forecast");
  const locale = useLocale();
  const lines = forecastLines(items);
  const tr = trendLine(trend);
  const m30 = pickForecast(items, "move", "30D");

  return (
    <section data-testid="forecast-text" className="space-y-2">
      <p className="text-xs uppercase tracking-label text-text-tertiary">{t("heading")}</p>
      {lines.map((l) => {
        const v = l.values;
        let text: string;
        if (l.key === "today") {
          text = t("line.today", {
            turnSign: t(`sign.${v.turnLevel}`),
            moveSign: t(`sign.${v.moveLevel}`),
          });
        } else if (l.key === "d30") {
          text = t("line.d30", { level: t(`level.${v.level}`), today: v.today, usual: v.usual });
          if (m30 && v.moveLevel !== undefined) {
            text += (locale === "en" ? " " : "") + t("line.d30_move", {
              moveLevel: t(`level.${forecastLevel(m30.today_pct, m30.usual_pct)}`),
              moveToday: v.moveToday,
              moveUsual: v.moveUsual,
            });
          }
        } else {
          text = t(`line.${l.key}`, { level: t(`level.${v.level}`), today: v.today, usual: v.usual });
        }
        return (
          <div key={l.key} className="space-y-1">
            <p data-testid={`forecast-line-${l.key}`} className="text-sm text-text-primary">
              {text}
            </p>
            {l.key === "today" && tr ? (
              <p data-testid="forecast-trend" className="text-sm text-text-secondary">
                {t(`trend.${tr.key}`, tr.values)}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
