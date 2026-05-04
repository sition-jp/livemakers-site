import { useTranslations } from "next-intl";
import type { DirectionBias } from "@/lib/pivots/types";

export function DirectionBiasBar({ bias }: { bias: DirectionBias }) {
  const t = useTranslations("turningPoints.directionBias");
  const total = Math.max(1, bias.bullish + bias.bearish + bias.neutral);
  const pct = (n: number) => (n / total) * 100;

  return (
    <div data-testid="direction-bias">
      <div
        role="img"
        aria-label={t("aria_summary", {
          bullish: Math.round(bias.bullish),
          bearish: Math.round(bias.bearish),
          neutral: Math.round(bias.neutral),
        })}
        className="flex h-3 w-full overflow-hidden rounded-sm border border-border-primary"
      >
        <span
          className="h-full bg-status-up"
          style={{ width: `${pct(bias.bullish)}%` }}
          aria-hidden="true"
        />
        <span
          className="h-full bg-text-tertiary opacity-60"
          style={{ width: `${pct(bias.neutral)}%` }}
          aria-hidden="true"
        />
        <span
          className="h-full bg-status-down"
          style={{ width: `${pct(bias.bearish)}%` }}
          aria-hidden="true"
        />
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div className="flex flex-col">
          <dt className="text-text-tertiary uppercase tracking-label">
            {t("bullish")}
          </dt>
          <dd className="text-status-up">{Math.round(bias.bullish)}%</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-text-tertiary uppercase tracking-label">
            {t("neutral")}
          </dt>
          <dd className="text-text-secondary">{Math.round(bias.neutral)}%</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-text-tertiary uppercase tracking-label">
            {t("bearish")}
          </dt>
          <dd className="text-status-down">{Math.round(bias.bearish)}%</dd>
        </div>
      </dl>
    </div>
  );
}
