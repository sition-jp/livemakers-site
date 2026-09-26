import { useTranslations } from "next-intl";
import { evidenceCopyKey } from "@/lib/pivots/evidence-copy";
import type { EvidenceItem, EvidenceCategory } from "@/lib/pivots/types";

const CATEGORY_CLASS: Record<EvidenceCategory, string> = { price: "text-pillar-overview", volatility: "text-pillar-market", volume: "text-pillar-ecosystem", oi: "text-pillar-governance", funding: "text-pillar-projects", confidence: "text-text-secondary" };

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  const t = useTranslations("turningPoints.evidence");
  const tc = useTranslations("turningPoints.evidenceCopy");
  if (items.length === 0) return <p className="text-sm text-text-tertiary">{t("empty")}</p>;
  return (
    <ul data-testid="evidence-list" className="divide-y divide-border-primary/60 border-y border-border-primary/60">
      {items.map((item, i) => {
        const ref = evidenceCopyKey(item.message);
        const text = ref ? tc(`${ref.key}.text`, { value: ref.value ?? "" }) : item.message;
        const meaning = ref ? tc(`${ref.key}.meaning`) : null;
        return (
          <li key={i} className="flex items-start gap-4 py-3" data-testid="evidence-item">
            <span className={`text-xs uppercase tracking-label whitespace-nowrap pt-0.5 ${CATEGORY_CLASS[item.category]}`}>{item.category}</span>
            <div className="flex-1">
              <p className="text-sm text-text-primary leading-relaxed">{text}</p>
              {meaning ? (
                <p className="text-xs text-text-secondary">
                  {t("meaning_label")}: <span>{meaning}</span>
                </p>
              ) : null}
            </div>
            <span className="text-xs text-text-tertiary tracking-label whitespace-nowrap pt-0.5">{t("weight")} {item.weight.toFixed(2)}</span>
          </li>
        );
      })}
    </ul>
  );
}
