import { useTranslations } from "next-intl";

const RADAR_LINES = ["what", "not", "levels", "pivots", "bias", "integrity", "freshness", "use"] as const;

export function ReadingGuide({ variant }: { variant: "radar" | "backtest" }) {
  const t = useTranslations("turningPoints.guide");
  return (
    <details data-testid="reading-guide" className="rounded-sm border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
      <summary className="cursor-pointer font-medium text-text-primary">
        {variant === "radar" ? t("title") : t("backtest_title")}
      </summary>
      {variant === "radar" ? (
        <ul className="mt-3 space-y-2 leading-relaxed">
          {RADAR_LINES.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 leading-relaxed">{t("backtest_body")}</p>
      )}
    </details>
  );
}
