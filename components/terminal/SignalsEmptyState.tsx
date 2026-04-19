/**
 * SignalsEmptyState — per-bucket placeholder when there are no signals to
 * render. See spec §6.2 / §6.3.
 *
 * Bucket-specific messages live in i18n (signals.empty.{actionable,active,
 * resolved,all}). The `all` bucket is used by the page as a whole-feed
 * empty state for the pre-SDE-launch case.
 */
import { useTranslations } from "next-intl";

export interface SignalsEmptyStateProps {
  bucket: "actionable" | "active" | "resolved" | "all";
}

export function SignalsEmptyState({ bucket }: SignalsEmptyStateProps) {
  const t = useTranslations("signals.empty");
  return (
    <div
      data-testid={`signals-empty-${bucket}`}
      className="border border-dashed border-border-primary/40 p-6 text-sm text-text-tertiary text-center rounded-sm"
    >
      {t(bucket)}
    </div>
  );
}
