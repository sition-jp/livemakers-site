/**
 * IntentDisclaimer — persistent banner for every /intents/* page.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md
 *       §4.8 + §9.2 (editorial tone, not legalistic).
 */
import { useTranslations } from "next-intl";

export function IntentDisclaimer() {
  const t = useTranslations("intents.disclaimer");
  return (
    <aside
      role="note"
      className="mb-6 rounded border border-slate-300/70 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
    >
      {t("body")}
    </aside>
  );
}
