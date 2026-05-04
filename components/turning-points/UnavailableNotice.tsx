import { useTranslations } from "next-intl";

/**
 * Rendered when the materialized JSON exists but is malformed or fails
 * schema validation (parseError !== null on the reader result). Distinct
 * from the file-absent / pre-launch empty state, which collapses to an
 * empty radar/backtest table without alarming copy.
 *
 * Codex review (P2.3): SSR pages must NOT silently degrade a schema
 * failure into "empty UI" — that hides producer/contract bugs in
 * operations.
 */
export function UnavailableNotice({
  reason,
  testid = "turning-points-unavailable",
}: {
  reason: string | null;
  testid?: string;
}) {
  const t = useTranslations("turningPoints.unavailable");
  return (
    <aside
      role="alert"
      data-testid={testid}
      className="rounded-sm border border-status-down/40 bg-status-down/10 px-6 py-6"
    >
      <h2 className="text-sm font-medium uppercase tracking-label text-status-down mb-2">
        {t("title")}
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-2">
        {t("body")}
      </p>
      {reason && (
        <p
          className="text-xs text-text-tertiary font-mono"
          data-testid={`${testid}-reason`}
        >
          {reason}
        </p>
      )}
    </aside>
  );
}
