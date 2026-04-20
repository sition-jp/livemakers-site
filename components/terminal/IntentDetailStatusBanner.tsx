/**
 * IntentDetailStatusBanner — render warning banner for non-live statuses.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §4.1 / §4.4
 *
 * Returns null for "approved" / "active" / "proposed" (no banner needed
 * for live states). Archived / cancelled / expired / completed / paused
 * render an amber banner with the corresponding i18n message.
 */
import { useTranslations } from "next-intl";

export type IntentStatusValue =
  | "proposed"
  | "approved"
  | "active"
  | "paused"
  | "cancelled"
  | "completed"
  | "expired"
  | "archived";

const BANNER_STATUSES: IntentStatusValue[] = [
  "archived",
  "cancelled",
  "expired",
  "completed",
  "paused",
];

export function IntentDetailStatusBanner({
  status,
}: {
  status: IntentStatusValue;
}) {
  const t = useTranslations("intents.detail.status_banner");
  if (!BANNER_STATUSES.includes(status)) return null;
  return (
    <aside
      role="note"
      className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
    >
      {t(status)}
    </aside>
  );
}
