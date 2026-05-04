import { useTranslations } from "next-intl";

/**
 * "Not financial advice" banner — PRD §26 + claude_next_steps L216.
 *
 * Rendered on every turning-points page. Kept as a discrete component so
 * future copy/style changes apply uniformly.
 */
export function DisclaimerBanner() {
  const t = useTranslations("turningPoints.disclaimer");
  return (
    <aside
      role="note"
      data-testid="disclaimer"
      className="rounded-sm border border-status-down/40 bg-status-down/10 px-4 py-3 text-xs leading-relaxed text-text-secondary"
    >
      <strong className="font-medium text-status-down uppercase tracking-label">
        {t("label")}
      </strong>
      <span className="ml-2">{t("body")}</span>
    </aside>
  );
}
