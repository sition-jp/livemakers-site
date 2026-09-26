import { useTranslations } from "next-intl";

import { describeState, scoreDelta, type StateDriver } from "@/lib/pivots/describe";
import type { DirectionBias } from "@/lib/pivots/types";

export interface StateBlockProps {
  scores: { overall: number; price_pivot: number; volatility_pivot: number };
  directionBias?: DirectionBias | null;
  mainSignal?: StateDriver | null;
  previous?: { overall?: number; price_pivot?: number; volatility_pivot?: number } | null;
  evidenceCount?: number;
  size?: "lg" | "sm";
}

const LEVEL_CLASS: Record<string, string> = {
  Low: "text-text-tertiary",
  Medium: "text-pillar-overview",
  High: "text-pillar-market",
  Extreme: "text-status-up",
};

export function formatDelta(delta: number | null): string | null {
  if (delta === null) return null;
  if (delta === 0) return "±0";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

export function StateBlock({ scores, directionBias, mainSignal, previous, evidenceCount, size = "lg" }: StateBlockProps) {
  const t = useTranslations("turningPoints.state");
  const s = describeState({ ...scores, direction_bias: directionBias ?? null, main_signal: mainSignal ?? null });
  const level = t(`level.${s.level}.label`);
  const driver = t(`driver.${s.driver}`);
  const direction = s.showDirection ? t(`direction.${s.direction}`) : t("direction_weak");
  const delta = formatDelta(scoreDelta(scores.overall, previous?.overall));

  return (
    <section data-testid="state-block" className="space-y-2">
      <p className="text-xs uppercase tracking-label text-text-tertiary">{t("heading")}</p>
      <p className={`${size === "lg" ? "text-3xl" : "text-lg"} font-medium ${LEVEL_CLASS[s.level]}`}>
        {level}
        <span className="ml-3 text-sm text-text-tertiary">{t("score_hint", { score: Math.round(scores.overall) })}</span>
        {delta !== null ? (
          <span className="ml-2 text-sm text-text-secondary" data-testid="delta-overall">
            {t("delta_label")} {delta}
          </span>
        ) : null}
      </p>
      <p className="text-sm text-text-secondary">{t(`level.${s.level}.meaning`)}</p>
      <p className="text-sm text-text-primary">{t(`level.${s.level}.action`)}</p>
      {typeof evidenceCount === "number" ? (
        <p className="text-sm text-text-secondary" data-testid="state-summary">
          {t("summary", { label: level, driver, direction, count: evidenceCount })}
        </p>
      ) : null}
    </section>
  );
}
