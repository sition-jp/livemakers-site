/**
 * SignalChainTable — supersede chain, reverse-chronological presentation.
 *
 * Spec: §5.7 v0.3 Finding 5 (order contract).
 * API / reader contract: chain[] asc by updated_at.
 * UI presentation: newest first. Reversal happens HERE only.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Signal } from "@/lib/signals";

interface Props {
  chain: Signal[]; // asc by updated_at per API contract
  currentId: string;
  locale: "en" | "ja";
}

export function SignalChainTable({ chain, currentId, locale }: Props) {
  const t = useTranslations("signals.detail.chain");
  const tSections = useTranslations("signals.detail.sections");
  // v0.3 Finding 5: reverse ONLY in this component
  const rowsDesc = [...chain].reverse();

  const fmtTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat(locale, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return iso;
    }
  };

  return (
    <section className="mt-6">
      <h2 className="text-xs uppercase tracking-wide opacity-60 mb-2">
        {tSections("chain", { count: chain.length })}
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase opacity-60 text-left">
            <th className="py-1 pr-4">{t("headers.time")}</th>
            <th className="py-1 pr-4">{t("headers.status")}</th>
            <th className="py-1 pr-4">{t("headers.confidence")}</th>
            <th className="py-1">{t("headers.id")}</th>
          </tr>
        </thead>
        <tbody>
          {rowsDesc.map((row) => {
            const isCurrent = row.id === currentId;
            const timeStr = (row as Signal & { updated_at?: string }).updated_at ?? row.created_at;
            return (
              <tr
                key={row.id}
                data-current={isCurrent ? "true" : "false"}
                className={isCurrent ? "font-semibold" : ""}
              >
                <td className="py-1 pr-4 font-mono text-xs">{fmtTime(timeStr)}</td>
                <td className="py-1 pr-4">{row.status}</td>
                <td className="py-1 pr-4 font-mono">{(row.confidence * 100).toFixed(0)}%</td>
                <td className="py-1 font-mono text-xs">
                  {isCurrent ? (
                    <span>
                      ⭐ {row.id} <span className="opacity-60">· {t("current_marker")}</span>
                    </span>
                  ) : (
                    <Link href={`/${locale}/signals/${row.id}`} className="underline">
                      {row.id}
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
