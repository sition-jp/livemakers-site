/**
 * SourceSignalTable — lists Intent's source Signals as a table with Links.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §4.7
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Signal } from "@/lib/signals";

export interface SourceSignalTableProps {
  signals: Signal[];
  missing: string[];
  locale: "en" | "ja";
}

export function SourceSignalTable({
  signals,
  missing,
  locale,
}: SourceSignalTableProps) {
  const tDetail = useTranslations("intents.detail");
  return (
    <div className="space-y-2">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-300/70 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th className="py-2 pr-3">ID</th>
            <th className="py-2 pr-3">Headline</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Conf</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => {
            const headline =
              locale === "ja" ? s.headline_ja : s.headline_en;
            return (
              <tr
                key={s.id}
                className="border-b border-slate-200 text-slate-800 dark:border-slate-800 dark:text-slate-200"
              >
                <td className="py-2 pr-3 font-mono text-xs">
                  <Link
                    href={`/${locale}/signals/${s.id}`}
                    className="text-sky-700 underline underline-offset-2 dark:text-sky-400"
                  >
                    {s.id}
                  </Link>
                </td>
                <td className="py-2 pr-3">{headline}</td>
                <td className="py-2 pr-3">{s.status}</td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {s.confidence.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {missing.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {tDetail("source_signal_missing", { count: missing.length })}
        </p>
      ) : null}
    </div>
  );
}
