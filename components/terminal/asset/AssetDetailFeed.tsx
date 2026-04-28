"use client";

/**
 * AssetDetailFeed — client wrapper for /assets/[asset].
 *
 * Fetches /api/assets/{asset}/summary via SWR (60s polling, mirrors the
 * /api/signals pattern), renders Price + Signals + News + (ADA only)
 * Governance Pulse.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md
 */
import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  AssetSummarySchema,
  type AssetSummary,
  type TerminalAssetT,
} from "@/lib/terminal/asset-summary";
import { PriceCard } from "./PriceCard";
import { SignalsList } from "./SignalsList";
import { NewsList } from "./NewsList";
import { GovernancePulsePanel } from "./GovernancePulsePanel";
import { ADAEcosystemPanel } from "./ADAEcosystemPanel";
import { BTCExtensionPanel } from "./BTCExtensionPanel";
import { ETHExtensionPanel } from "./ETHExtensionPanel";
import { NIGHTExtensionPanel } from "./NIGHTExtensionPanel";

interface AssetDetailFeedProps {
  asset: TerminalAssetT;
  initialData?: AssetSummary | null;
}

async function fetcher(url: string): Promise<AssetSummary> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`asset summary ${res.status}`);
  }
  const json = await res.json();
  // Defensive client-side validate so a contract drift surfaces visibly.
  const parsed = AssetSummarySchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("asset summary contract drift");
  }
  return parsed.data;
}

export function AssetDetailFeed({ asset, initialData }: AssetDetailFeedProps) {
  const tFresh = useTranslations("assets");
  const url = `/api/assets/${asset.toLowerCase()}/summary`;

  const { data, error } = useSWR<AssetSummary>(url, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    fallbackData: initialData ?? undefined,
  });

  if (error && !data) {
    return (
      <div className="rounded-lg border border-status-down/30 bg-status-down/5 p-6 text-sm text-status-down">
        {error.message}
      </div>
    );
  }

  if (!data) {
    // Initial loading — minimal placeholder; page shell still renders.
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-lg bg-bg-secondary" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg bg-bg-secondary" />
          <div className="h-48 animate-pulse rounded-lg bg-bg-secondary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PriceCard asset={data.display_name} price={data.price} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SignalsList
          asset={data.display_name}
          totalActive={data.signals.total_active}
          items={data.signals.items}
        />
        <NewsList
          asset={data.display_name}
          total={data.news.total}
          items={data.news.items}
        />
      </div>

      {data.asset === "ADA" && data.ada && (
        <>
          {data.ada.governance && (
            <GovernancePulsePanel pulse={data.ada.governance} />
          )}
          <ADAEcosystemPanel extension={data.ada} />
        </>
      )}
      {data.asset === "BTC" && data.btc && (
        <BTCExtensionPanel extension={data.btc} />
      )}
      {data.asset === "ETH" && data.eth && (
        <ETHExtensionPanel extension={data.eth} />
      )}
      {data.asset === "NIGHT" && data.night && (
        <NIGHTExtensionPanel extension={data.night} />
      )}

      {/* Freshness footer */}
      <div className="text-right text-[11px] uppercase tracking-label text-text-tertiary">
        {data.price
          ? tFresh("freshness", {
              sec: Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(data.updated_at).getTime()) / 1000,
                ),
              ),
            })
          : tFresh("freshness_pre_launch")}
      </div>
    </div>
  );
}
