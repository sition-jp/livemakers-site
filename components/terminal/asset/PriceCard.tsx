/**
 * PriceCard — current price snapshot for the asset detail header.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §5.1
 *       08_DOCS/knowledge/specs/2026-04-30-sde-terminal-live-snapshot-v0.1.md §4.3-4.4
 *
 * `price` is the static snapshot from `/api/dashboard` (6h cadence).
 * `liveData` is the per-asset entry from `/api/dashboard/live` (≤2-min cadence).
 * When `liveData` is present and usable, live price/change/volume/source/
 * updated_at overlay onto the static row (market_cap stays from static, since
 * the live snapshot does not carry it). When `liveData` is absent or its
 * `status === "unavailable"`, the existing static-only behaviour is preserved
 * exactly — these props are non-breaking.
 *
 * Day 5: when `liveData` is provided (regardless of value), a staleness
 * badge is rendered to the right of the price block. Tier from
 * `stalenessTier(liveStaleness)`:
 *   live (<60s) green / slightly_stale (60-180s) yellow /
 *   stale (180-360s) orange / stale_hard (≥360s) red /
 *   unavailable (null) grey. Badge is hidden when `liveData === undefined`
 *   so legacy callers without live wiring stay visually identical.
 */
import { useTranslations } from "next-intl";
import type { Price } from "@/lib/terminal/asset-summary";
import {
  mergeLivePriceForDisplay,
  type LiveAssetEntry,
} from "@/lib/terminal/asset-live";
import {
  stalenessTier,
  stalenessTextClass,
} from "@/lib/terminal/staleness-tier";

interface PriceCardProps {
  asset: string;
  price: Price | null;
  liveData?: LiveAssetEntry | null;
  liveStaleness?: number | null;
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

export function PriceCard({
  asset,
  price,
  liveData,
  liveStaleness,
}: PriceCardProps) {
  const t = useTranslations("assets.price");

  const effectivePrice = mergeLivePriceForDisplay(price, liveData);
  const liveActive =
    effectivePrice !== null &&
    effectivePrice !== price &&
    liveData != null &&
    liveData.status !== "unavailable";

  // Badge visibility — only shown when the caller wired live data at all.
  // `liveData === undefined` means a legacy static-only caller; skip badge
  // entirely to keep their UI byte-identical.
  const showStalenessBadge = liveData !== undefined;
  const tier = stalenessTier(liveStaleness);
  const badgeText =
    tier === "live"
      ? t("staleness.live")
      : tier === "stale_hard"
        ? t("staleness.stale_hard")
        : tier === "unavailable"
          ? t("staleness.unavailable")
          : t(`staleness.${tier}`, {
              sec: Math.max(0, Math.floor(liveStaleness ?? 0)),
            });

  // Single source of truth for the badge JSX so both the happy-path and
  // the unavailable early-return render identical markup. Reviewer flagged
  // [P2]: in pre-launch / missing-file states where `price=null` AND live
  // is unavailable, the early return previously skipped the badge — users
  // saw the static "—" block without any indication that the live lane is
  // wired but offline.
  const badge = showStalenessBadge ? (
    <span
      className={`text-[11px] font-medium uppercase tracking-label ${stalenessTextClass(tier)}`}
      data-testid="price-staleness-badge"
      data-staleness-tier={tier}
    >
      <span aria-hidden="true" className="mr-1">
        ●
      </span>
      {badgeText}
    </span>
  ) : null;

  if (effectivePrice == null) {
    return (
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-6"
        aria-label={t("title")}
        data-live-active="false"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-label text-text-tertiary">
              {t("title")}
            </div>
            <div className="mt-3 text-3xl font-light text-text-secondary">
              {t("unavailable")}
            </div>
          </div>
          {badge}
        </div>
      </section>
    );
  }

  const changePos = effectivePrice.change_24h_pct >= 0;
  const changeColor = changePos ? "text-status-up" : "text-status-down";
  const changeSign = changePos ? "+" : "";

  return (
    <section
      className="rounded-lg border border-border-primary bg-bg-secondary p-6"
      aria-label={t("title")}
      data-live-active={liveActive ? "true" : "false"}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-label text-text-tertiary">
            {t("title")}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-4xl font-light tracking-title">
              ${formatUSD(effectivePrice.usd)}
            </span>
            <span
              className={`text-lg font-medium ${changeColor}`}
              data-testid="price-change-24h"
            >
              {changeSign}
              {effectivePrice.change_24h_pct.toFixed(2)}% {t("change_24h")}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          {badge}
          <div className="text-xs uppercase tracking-label text-text-tertiary">
            {effectivePrice.source}
          </div>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-text-tertiary">{t("market_cap")}</dt>
          <dd className="text-text-primary">
            {formatCompactUSD(effectivePrice.market_cap_usd)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-tertiary">{t("volume_24h")}</dt>
          <dd className="text-text-primary">
            {formatCompactUSD(effectivePrice.volume_24h_usd)}
          </dd>
        </div>
      </dl>

      <div
        className="mt-4 text-[11px] uppercase tracking-label text-text-tertiary"
        data-testid={`price-asset-${asset}`}
      >
        {asset} · {t("updated")}{" "}
        {new Date(effectivePrice.updated_at).toUTCString()}
      </div>
    </section>
  );
}
