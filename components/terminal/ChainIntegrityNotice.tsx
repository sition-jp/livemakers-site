/**
 * ChainIntegrityNotice — analyst-oriented surface for chain_integrity_warnings.
 * Collapsible by default so the main reading flow is not interrupted.
 */
import { useTranslations } from "next-intl";

interface Props {
  warnings: string[];
  locale: "en" | "ja";
}

export function ChainIntegrityNotice({ warnings, locale: _locale }: Props) {
  const t = useTranslations("signals.detail.chain_integrity_notice");
  if (warnings.length === 0) return null;
  return (
    <details className="mt-4 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-amber-900 dark:text-amber-200">
        {t("title")} ({warnings.length})
      </summary>
      <div className="mt-2 text-xs">
        <p className="mb-1 opacity-80">{t("intro")}</p>
        <ul className="space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="font-mono">
              {t("warning_prefix")} {w}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
