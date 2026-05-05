import { useTranslations } from "next-intl";

export function ProvisionalBacktestBanner() {
  const t = useTranslations("turningPoints.backtestProvisional");
  return (
    <aside
      role="note"
      data-testid="backtest-provisional"
      className="rounded-sm border border-pillar-risk/40 bg-pillar-risk/10 px-4 py-3 text-xs leading-relaxed text-text-secondary"
    >
      <strong className="font-medium text-pillar-risk uppercase tracking-label">
        {t("title")}
      </strong>
      <span className="ml-2">{t("body")}</span>
    </aside>
  );
}
