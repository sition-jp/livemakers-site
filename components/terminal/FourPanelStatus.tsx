import { useTranslations } from "next-intl";
import type { FourPanelSummary } from "@/lib/types";

export function FourPanelStatus({ summary }: { summary: FourPanelSummary }) {
  const t = useTranslations("overview");

  const panels = [
    { key: "governance", label: "GOVERNANCE", color: "text-pillar-governance", body: summary.governance },
    { key: "defi", label: "DEFI", color: "text-pillar-ecosystem", body: summary.defi },
    { key: "midnight", label: "MIDNIGHT", color: "text-pillar-midnight", body: summary.midnight },
    { key: "risk", label: "RISK", color: "text-pillar-risk", body: summary.risk },
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
