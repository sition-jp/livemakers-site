import { useLocale, useTranslations } from "next-intl";

import { forecastLevel, formatPrice, pickForecast, type Level } from "@/lib/pivots/forecast";
import { legendItems, type RangeBandOne } from "@/lib/pivots/range-band";
import { tenScale } from "@/lib/pivots/regime";
import type { AssetSymbol, ForecastItem, LadderRow, TurnRate } from "@/lib/pivots/types";

export interface TurnCardsProps {
  asset: AssetSymbol;
  forecast?: ForecastItem[];
  ladder?: LadderRow[];
  turnRate?: TurnRate[AssetSymbol] | null;
  band?: RangeBandOne | null;
}

const LEVEL_CLASS: Record<Level, string> = {
  above: "text-pillar-market",
  usual: "text-text-primary",
  below: "text-text-tertiary",
};

const SIZES = [
  { size: "mid", horizon: "30D", strength: "medium", pct: 15, testId: "turn-card-30" },
  { size: "small", horizon: "7D", strength: "small", pct: 5, testId: "turn-card-7" },
] as const;

function md(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return { month: m, day: d };
}

function daysBetween(fromIso: string, toIso: string) {
  const f = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.max(0, Math.round((to - f) / 86400000));
}

function Dots({ n, usual }: { n: number; usual?: boolean }) {
  const tone = usual ? "border-text-tertiary" : "border-pillar-projects";
  const fill = usual ? "bg-text-tertiary" : "bg-pillar-projects";
  return (
    <span aria-hidden="true" className="flex gap-[3px]">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={`block h-3 w-3 rounded-full border-[1.5px] ${tone} ${i < n ? fill : ""}`} />
      ))}
    </span>
  );
}

export function TurnCards({ asset, forecast, ladder, turnRate, band }: TurnCardsProps) {
  const t = useTranslations("turningPoints.v2.turnCards");
  const tf = useTranslations("turningPoints.forecast");
  const locale = useLocale();
  const cards = SIZES.map((s) => ({ s, item: pickForecast(forecast, "turn", s.horizon) })).filter(
    (c): c is { s: (typeof SIZES)[number]; item: ForecastItem } => c.item !== null,
  );
  if (cards.length === 0) return null;
  const b30 = band ? legendItems(band).find((l) => l.id === "b30") : undefined;

  return (
    <section data-testid={`turn-cards-${asset}`} className="space-y-3">
      <h3 className="text-lg font-medium text-text-primary">
        {t("title")} <span className="text-sm font-normal text-text-tertiary">{t("subtitle")}</span>
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ s, item }) => {
          const todayN = tenScale(item.today_pct);
          const usualN = tenScale(item.usual_pct);
          const level = forecastLevel(item.today_pct, item.usual_pct);
          const row = ladder?.find((r) => r.strength === s.strength);
          const cand = row?.decided ? row.candidate : null;
          const last = row?.last_confirmed ?? null;
          const rate = turnRate ? turnRate[s.strength === "medium" ? "medium" : "small"] : null;
          const nowClose = band?.close;

          const facts: { k: string; v: string }[] = [];
          if (last && band) {
            const d = md(last.date);
            const price = formatPrice(last.close);
            const top = last.kind === "top";
            if (s.size === "small") {
              facts.push({
                k: "now",
                v: t(top ? "nowNoTurnTop" : "nowNoTurnBottom", {
                  ...d,
                  price,
                  days: String(daysBetween(last.date, band.as_of)),
                }),
              });
            } else {
              let v = t(top ? "nowAfterTop" : "nowAfterBottom", { size: s.size, ...d, price });
              if (last.confirmed_date) {
                v += (locale === "en" ? " " : "") + t(top ? "confirmedTop" : "confirmedBottom", {
                  size: s.size,
                  ...md(last.confirmed_date),
                  pct: String(s.pct),
                });
              }
              facts.push({ k: "now", v });
            }
          }
          if (cand && row?.confirm_at != null && nowClose !== undefined) {
            facts.push({
              k: cand.kind === "bottom" ? "countBottom" : "countTop",
              v: t(cand.kind === "bottom" ? "countBottom" : "countTop", {
                size: s.size,
                pct: String(s.pct),
                now: formatPrice(nowClose),
                price: formatPrice(row.confirm_at),
              }),
            });
          }
          if (rate && rate.per_year > 0) {
            facts.push({
              k: "freq",
              v:
                s.size === "mid"
                  ? t("freqMid", {
                      asset,
                      perYear: String(Math.round(rate.per_year)),
                      weeks: String(Math.round(52 / rate.per_year)),
                      recent: String(rate.last_365),
                    })
                  : t("freqSmall", {
                      perYear: String(Math.round(rate.per_year)),
                      days: String(Math.round(365 / rate.per_year)),
                    }),
            });
          }

          return (
            <article
              key={s.testId}
              data-testid={s.testId}
              className="space-y-2 rounded border border-border-primary p-4"
            >
              <p className="text-sm font-bold text-text-primary">{t(`q.${s.size}`)}</p>
              <p className="text-xs leading-relaxed text-text-tertiary">
                {t(`def.${s.size}`, { bandPct: b30?.widthPct ?? "" })}
              </p>
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="w-14 text-xs text-text-tertiary">{t("who.today")}</span>
                <Dots n={todayN} />
                <span className="text-lg font-semibold text-text-primary">
                  {t("odds", { n: todayN, pct: Math.round(item.today_pct) })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="w-14 text-xs text-text-tertiary">{t("who.usual")}</span>
                <Dots n={usualN} usual />
                <span className="text-sm text-text-secondary">
                  {t("odds", { n: usualN, pct: Math.round(item.usual_pct) })}
                </span>
              </div>
              <p className={`text-sm font-bold ${LEVEL_CLASS[level]}`}>{tf(`level.${level}`)}</p>
              <p className="text-sm text-text-primary">
                {t(`mean.${s.size}.${level}`, { n: todayN, restN: 10 - todayN, usualN })}
              </p>
              {facts.length > 0 ? (
                <dl className="space-y-1 border-t border-border-primary pt-2 text-xs">
                  {facts.map((f) => (
                    <div key={f.k}>
                      <dt className="text-text-tertiary">
                        {f.k === "now"
                          ? t("facts.now")
                          : f.k === "freq"
                            ? t("facts.freq")
                            : t(`facts.${f.k}`, { size: s.size })}
                      </dt>
                      <dd className="text-text-secondary">{f.v}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </article>
          );
        })}
      </div>
      <p className="text-xs text-text-tertiary">{t("note")}</p>
    </section>
  );
}
