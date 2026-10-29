import { useTranslations } from "next-intl";

const RADAR_LINES = ["what", "not", "levels", "pivots", "bias", "integrity", "freshness", "use"] as const;
const FORECAST_LINES = [
  "forecast_what",
  "forecast_not",
  "forecast_signal",
  "forecast_ladder",
  "forecast_resolve",
  "forecast_condition",
  "forecast_backfill",
  "forecast_date",
  "freshness",
] as const;

export function ReadingGuide({ variant }: { variant: "radar" | "backtest" | "forecast" }) {
  const t = useTranslations("turningPoints.guide");
  const title =
    variant === "radar" ? t("title") : variant === "forecast" ? t("forecast_title") : t("backtest_title");
  return (
    <details data-testid="reading-guide" className="rounded-sm border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
      <summary className="cursor-pointer font-medium text-text-primary">{title}</summary>
      {variant === "radar" || variant === "forecast" ? (
        <ul className="mt-3 space-y-2 leading-relaxed">
          {(variant === "radar" ? RADAR_LINES : FORECAST_LINES).map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 leading-relaxed">{t("backtest_body")}</p>
      )}
    </details>
  );
}
