/**
 * BTCExtensionPanel — Bitcoin spot ETF aggregate stats.
 */
import { useTranslations } from "next-intl";
import type { BTCExtension } from "@/lib/terminal/asset-summary";

interface BTCExtensionPanelProps {
  extension: BTCExtension;
}

function formatCompactUSD(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatFlowUSD(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatCompactUSD(value).slice(value < 0 ? 1 : 0)}`;
}

export function BTCExtensionPanel({ extension }: BTCExtensionPanelProps) {
  const t = useTranslations("assets.btc_ext");
  const flowPositive = extension.etf.weekly_flow_usd >= 0;

  return (
    <section
      className="rounded-lg border border-pillar-market/30 bg-bg-secondary p-6"
      aria-label={t("title")}
    >
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-medium tracking-title text-pillar-market">
            {t("title")}
          </h2>
          <p className="mt-1 text-xs text-text-tertiary">{t("subtitle")}</p>
        </div>
        <span className="text-[11px] uppercase tracking-label text-text-tertiary">
          {t("source")}
        </span>
      </header>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border-primary bg-bg-tertiary p-4">
          <dt className="mb-2 text-[11px] uppercase tracking-label text-text-tertiary">
            {t("aum_usd")}
          </dt>
          <dd className="text-2xl font-light tracking-title text-text-primary">
            {formatCompactUSD(extension.etf.aum_usd)}
          </dd>
        </div>
        <div className="rounded-md border border-border-primary bg-bg-tertiary p-4">
          <dt className="mb-2 text-[11px] uppercase tracking-label text-text-tertiary">
            {t("weekly_flow_usd")}
          </dt>
          <dd
            className={`text-2xl font-light tracking-title ${
              flowPositive ? "text-status-up" : "text-status-down"
            }`}
          >
            {flowPositive ? "+" : ""}
            {formatCompactUSD(Math.abs(extension.etf.weekly_flow_usd))}
          </dd>
        </div>
        <div className="rounded-md border border-border-primary bg-bg-tertiary p-4">
          <dt className="mb-2 text-[11px] uppercase tracking-label text-text-tertiary">
            {t("supply_pct_held")}
          </dt>
          <dd className="text-2xl font-light tracking-title text-text-primary">
            {extension.etf.supply_pct_held.toFixed(2)}%
          </dd>
        </div>
      </dl>
    </section>
  );
}
