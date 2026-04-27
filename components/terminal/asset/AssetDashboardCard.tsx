/**
 * AssetDashboardCard — single-asset summary tile for the 4-asset dashboard.
 *
 * Renders price + signals/news counts + an asset-specific headline metric
 * (BTC=ETF AUM, ETH=staking ratio, ADA=DeFi TVL, NIGHT=dApps count).
 * Whole tile is a link to the asset detail page.
 */
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type {
  AssetSummary,
  TerminalAssetT,
} from "@/lib/terminal/asset-summary";

interface AssetDashboardCardProps {
  summary: AssetSummary;
}

const ACCENT_COLOR: Record<TerminalAssetT, string> = {
  BTC: "border-pillar-market/30 hover:border-pillar-market",
  ETH: "border-pillar-market/30 hover:border-pillar-market",
  ADA: "border-pillar-ecosystem/30 hover:border-pillar-ecosystem",
  NIGHT: "border-pillar-midnight/30 hover:border-pillar-midnight",
};

const TITLE_COLOR: Record<TerminalAssetT, string> = {
  BTC: "text-pillar-market",
  ETH: "text-pillar-market",
  ADA: "text-pillar-ecosystem",
  NIGHT: "text-pillar-midnight",
};

function formatPrice(value: number): string {
  if (value >= 1_000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
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

interface HeadlineMetric {
  label: string;
  value: string;
  color?: string;
}

function btcMetrics(summary: AssetSummary, t: ReturnType<typeof useTranslations>): HeadlineMetric[] {
  const ext = summary.btc;
  if (!ext) {
    return [
      { label: t("btc_aum"), value: t("no_data") },
      { label: t("btc_weekly_flow"), value: t("no_data") },
    ];
  }
  const flowPos = ext.etf.weekly_flow_usd >= 0;
  return [
    { label: t("btc_aum"), value: formatCompactUSD(ext.etf.aum_usd) },
    {
      label: t("btc_weekly_flow"),
      value: `${flowPos ? "+" : ""}${formatCompactUSD(Math.abs(ext.etf.weekly_flow_usd))}`,
      color: flowPos ? "text-status-up" : "text-status-down",
    },
  ];
}

function ethMetrics(summary: AssetSummary, t: ReturnType<typeof useTranslations>): HeadlineMetric[] {
  const ext = summary.eth;
  if (!ext) {
    return [
      { label: t("eth_aum"), value: t("no_data") },
      { label: t("eth_staking_ratio"), value: t("no_data") },
    ];
  }
  return [
    { label: t("eth_aum"), value: formatCompactUSD(ext.etf.aum_usd) },
    {
      label: t("eth_staking_ratio"),
      value: `${ext.staking_ratio_pct.toFixed(2)}%`,
    },
  ];
}

function adaMetrics(summary: AssetSummary, t: ReturnType<typeof useTranslations>): HeadlineMetric[] {
  const ext = summary.ada;
  if (!ext) {
    return [
      { label: t("ada_tvl"), value: t("no_data") },
      { label: t("ada_epoch"), value: t("no_data") },
    ];
  }
  return [
    {
      label: t("ada_tvl"),
      value:
        ext.defi.tvl_usd > 0 ? formatCompactUSD(ext.defi.tvl_usd) : t("no_data"),
    },
    {
      label: t("ada_epoch"),
      value:
        ext.epoch.current > 0
          ? `#${ext.epoch.current} (${ext.epoch.progress_pct.toFixed(0)}%)`
          : t("no_data"),
    },
  ];
}

function nightMetrics(summary: AssetSummary, t: ReturnType<typeof useTranslations>): HeadlineMetric[] {
  const ext = summary.night;
  if (!ext) {
    return [
      { label: t("night_dapps"), value: t("no_data") },
      { label: t("night_block"), value: t("no_data") },
    ];
  }
  return [
    { label: t("night_dapps"), value: String(ext.dapps.total_listed) },
    {
      label: t("night_block"),
      value:
        ext.network.block_height != null
          ? ext.network.block_height.toLocaleString("en-US")
          : t("no_data"),
    },
  ];
}

export function AssetDashboardCard({ summary }: AssetDashboardCardProps) {
  const t = useTranslations("assets.dashboard");

  const metrics: HeadlineMetric[] =
    summary.asset === "BTC"
      ? btcMetrics(summary, t)
      : summary.asset === "ETH"
        ? ethMetrics(summary, t)
        : summary.asset === "ADA"
          ? adaMetrics(summary, t)
          : nightMetrics(summary, t);

  const price = summary.price;
  const changePos = (price?.change_24h_pct ?? 0) >= 0;

  return (
    <Link
      href={`/assets/${summary.asset.toLowerCase()}`}
      className={`block rounded-lg border bg-bg-secondary p-6 transition-colors ${ACCENT_COLOR[summary.asset]}`}
    >
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <div
            className={`text-xs uppercase tracking-label ${TITLE_COLOR[summary.asset]}`}
          >
            {summary.asset}
          </div>
          <h2 className="text-base font-medium tracking-title text-text-primary">
            {summary.display_name}
          </h2>
        </div>
        <span className="text-[11px] uppercase tracking-label text-text-tertiary">
          {t("view_detail")}
        </span>
      </header>

      {/* Price */}
      <div className="mb-5">
        {price ? (
          <>
            <div className="text-3xl font-light tracking-title">
              ${formatPrice(price.usd)}
            </div>
            <div
              className={`mt-1 text-sm ${
                changePos ? "text-status-up" : "text-status-down"
              }`}
            >
              {changePos ? "+" : ""}
              {price.change_24h_pct.toFixed(2)}% 24h
            </div>
          </>
        ) : (
          <div className="text-3xl font-light text-text-secondary">—</div>
        )}
      </div>

      {/* Headline metrics */}
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col">
            <dt className="text-[11px] uppercase tracking-label text-text-tertiary">
              {m.label}
            </dt>
            <dd className={m.color ?? "text-text-primary"}>{m.value}</dd>
          </div>
        ))}
      </dl>

      {/* Counts */}
      <div className="flex items-center gap-4 text-[11px] uppercase tracking-label text-text-tertiary">
        <span>{t("signals_count", { n: summary.signals.total_active })}</span>
        <span>·</span>
        <span>{t("news_count", { n: summary.news.total })}</span>
      </div>
    </Link>
  );
}
