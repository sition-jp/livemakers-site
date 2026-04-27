/**
 * PriceCard — current price snapshot for the asset detail header.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §5.1
 */
import { useTranslations } from "next-intl";
import type { Price } from "@/lib/terminal/asset-summary";

interface PriceCardProps {
  asset: string;
  price: Price | null;
}

function formatUSD(value: number): string {
  if (value >= 1_000) {
    return value.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  }
  if (value >= 1) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatCompactUSD(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function PriceCard({ asset, price }: PriceCardProps) {
  const t = useTranslations("assets.price");

  if (price == null) {
    return (
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-6"
        aria-label={t("title")}
      >
        <div className="text-xs uppercase tracking-label text-text-tertiary">
          {t("title")}
        </div>
        <div className="mt-3 text-3xl font-light text-text-secondary">
          {t("unavailable")}
        </div>
      </section>
    );
  }

  const changePos = price.change_24h_pct >= 0;
  const changeColor = changePos ? "text-status-up" : "text-status-down";
  const changeSign = changePos ? "+" : "";

  return (
    <section
      className="rounded-lg border border-border-primary bg-bg-secondary p-6"
      aria-label={t("title")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-label text-text-tertiary">
            {t("title")}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-4xl font-light tracking-title">
              ${formatUSD(price.usd)}
            </span>
            <span
              className={`text-lg font-medium ${changeColor}`}
              data-testid="price-change-24h"
            >
              {changeSign}
              {price.change_24h_pct.toFixed(2)}% {t("change_24h")}
            </span>
          </div>
        </div>
        <div className="text-right text-xs uppercase tracking-label text-text-tertiary">
          {price.source}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-text-tertiary">{t("market_cap")}</dt>
          <dd className="text-text-primary">
            {formatCompactUSD(price.market_cap_usd)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-tertiary">{t("volume_24h")}</dt>
          <dd className="text-text-primary">
            {formatCompactUSD(price.volume_24h_usd)}
          </dd>
        </div>
      </dl>

      <div
        className="mt-4 text-[11px] uppercase tracking-label text-text-tertiary"
        data-testid={`price-asset-${asset}`}
      >
        {asset} · {t("updated")} {new Date(price.updated_at).toUTCString()}
      </div>
    </section>
  );
}
