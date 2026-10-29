import { useLocale, useTranslations } from "next-intl";

import { formatDay, formatPrice, formatSignedPct, ladderRows } from "@/lib/pivots/forecast";
import type { LadderRow } from "@/lib/pivots/types";

export interface StrengthLadderProps {
  rows?: LadderRow[];
  nowClose: number | null;
}

export function StrengthLadder({ rows, nowClose }: StrengthLadderProps) {
  const t = useTranslations("turningPoints.ladder");
  const locale = useLocale() as "ja" | "en";
  const views = ladderRows(rows, nowClose);
  if (views.length === 0) return null;

  return (
    <section data-testid="strength-ladder" className="space-y-3">
      <p className="text-xs uppercase tracking-label text-text-tertiary">{t("heading")}</p>
      <p className="text-sm text-text-secondary">{t("lead")}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-label text-text-tertiary">
              <th className="py-2 pr-3 font-normal">{t("col_strength")}</th>
              <th className="py-2 pr-3 font-normal">{t("col_last")}</th>
              <th className="py-2 pr-3 font-normal">{t("col_candidate")}</th>
              <th className="py-2 font-normal">{t("col_condition")}</th>
            </tr>
          </thead>
          <tbody>
            {views.map((v) => {
              const lc = v.lastConfirmed;
              const cand = v.candidate;
              const cond = v.condition;
              return (
                <tr
                  key={v.strength}
                  data-testid={`ladder-row-${v.strength}`}
                  className="border-t border-border-primary align-top"
                >
                  <td className="py-2 pr-3 text-text-primary">
                    {t(`strength.${v.strength}`)}
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">
                    {lc
                      ? lc.pctFromNow === null
                        ? t("last_nopct", {
                            date: formatDay(lc.date, locale),
                            kind: t(`kind.${lc.kind}`),
                            close: formatPrice(lc.close),
                          })
                        : t("last", {
                            date: formatDay(lc.date, locale),
                            kind: t(`kind.${lc.kind}`),
                            close: formatPrice(lc.close),
                            pct: formatSignedPct(lc.pctFromNow),
                          })
                      : t("none")}
                    {v.note ? (
                      <span
                        data-testid={`ladder-note-${v.strength}`}
                        className="mt-1 block text-xs text-text-tertiary"
                      >
                        {t(lc?.kind === "bottom" ? "note_bottom" : "note_top", {
                          date: formatDay(v.note.date, locale),
                          close: formatPrice(v.note.close),
                        })}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">
                    {cand
                      ? t("candidate", {
                          kind: t(`kind.${cand.kind}`),
                          date: formatDay(cand.date, locale),
                          close: formatPrice(cand.close),
                        })
                      : t("none")}
                  </td>
                  <td className="py-2 text-text-secondary">
                    {cond
                      ? cond.pctFromNow === null
                        ? t(`condition_${cond.kind}_nopct`, {
                            threshold: t(`threshold.${v.threshold}`),
                            price: formatPrice(cond.price),
                          })
                        : t(`condition_${cond.kind}`, {
                            threshold: t(`threshold.${v.threshold}`),
                            price: formatPrice(cond.price),
                            pct: formatSignedPct(cond.pctFromNow),
                          })
                      : t("none")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
