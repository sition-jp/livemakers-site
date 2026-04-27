/**
 * SignalsList — top N signals scoped to the current asset.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §5.1
 */
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AssetSignalRef } from "@/lib/terminal/asset-summary";

interface SignalsListProps {
  asset: string;
  totalActive: number;
  items: AssetSignalRef[];
}

const PILLAR_TOKEN: Record<string, string> = {
  market_and_capital_flows: "text-pillar-market",
  ecosystem_health: "text-pillar-ecosystem",
  governance_and_treasury: "text-pillar-governance",
  midnight_and_privacy: "text-pillar-midnight",
  risk_and_compliance: "text-pillar-risk",
  project_research: "text-pillar-projects",
};

const DIRECTION_COLOR: Record<string, string> = {
  positive: "text-status-up",
  negative: "text-status-down",
  neutral: "text-text-secondary",
  mixed: "text-pillar-governance",
};

export function SignalsList({ asset, totalActive, items }: SignalsListProps) {
  const t = useTranslations("assets.signals");

  if (items.length === 0) {
    return (
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-6"
        aria-label={t("title")}
      >
        <header className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xs uppercase tracking-label text-text-tertiary">
            {t("title")}
          </h2>
        </header>
        <p className="text-sm text-text-secondary">{t("none", { asset })}</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-border-primary bg-bg-secondary p-6"
      aria-label={t("title")}
    >
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-label text-text-tertiary">
          {t("title")}
        </h2>
        <span className="text-[11px] uppercase tracking-label text-text-tertiary">
          {t("active_count", { n: totalActive })}
        </span>
      </header>
      <ul className="space-y-3">
        {items.map((s) => (
          <li
            key={s.id}
            className="rounded-md border border-transparent p-3 transition-colors hover:border-border-hover hover:bg-bg-tertiary"
          >
            <Link href={s.href} className="block">
              <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-label">
                <span
                  className={
                    PILLAR_TOKEN[s.pillar] ?? "text-text-tertiary"
                  }
                >
                  {s.pillar.replaceAll("_", " ")}
                </span>
                <span className="text-text-tertiary">·</span>
                <span className="text-text-tertiary">
                  conf {s.confidence.toFixed(2)}
                </span>
                <span className="text-text-tertiary">·</span>
                <span
                  className={DIRECTION_COLOR[s.direction] ?? "text-text-secondary"}
                >
                  {s.direction}
                </span>
                <span className="text-text-tertiary">·</span>
                <span className="text-text-tertiary">{s.impact}</span>
              </div>
              <div className="text-sm text-text-primary">{s.headline_ja}</div>
              <div className="mt-1 text-xs text-text-tertiary">
                {s.headline_en}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-right">
        <Link
          href="/signals"
          className="text-xs text-pillar-overview hover:underline"
        >
          {t("see_all")}
        </Link>
      </div>
    </section>
  );
}
