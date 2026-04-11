import { useTranslations } from "next-intl";
import type { FourPanelSummary } from "@/lib/types";

export function FourPanelStatus({
  summary,
  locale,
}: {
  summary: FourPanelSummary;
  locale: string;
}) {
  const t = useTranslations("overview");

  // Pick JA copy when on /ja AND the brief actually ships a JA translation
  // for that panel. Falls back to EN otherwise so older briefs (and any panel
  // the editor forgot to translate) still render something coherent.
  const pick = (en: string, ja: string | undefined) =>
    locale === "ja" && ja ? ja : en;

  const panels = [
    {
      key: "governance",
      label: "GOVERNANCE",
      color: "text-pillar-governance",
      body: pick(summary.governance, summary.governance_ja),
    },
    {
      key: "defi",
      label: "DEFI",
      color: "text-pillar-ecosystem",
      body: pick(summary.defi, summary.defi_ja),
    },
    {
      key: "midnight",
      label: "MIDNIGHT",
      color: "text-pillar-midnight",
      body: pick(summary.midnight, summary.midnight_ja),
    },
    {
      key: "risk",
      label: "RISK",
      color: "text-pillar-risk",
      body: pick(summary.risk, summary.risk_ja),
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 text-[10px] tracking-label text-text-tertiary">
        {t("fourPanelTitle")}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {panels.map((p) => (
          <div key={p.key} className="border border-border-primary bg-bg-secondary p-6">
            <div className={`mb-3 text-[10px] tracking-label ${p.color}`}>{p.label}</div>
            <p className="text-sm leading-relaxed text-text-secondary">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
