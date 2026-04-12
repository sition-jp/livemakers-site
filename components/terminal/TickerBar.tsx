"use client";

import useSWR from "swr";
import type { TickerResponse } from "@/lib/types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("ticker fetch failed");
    return r.json() as Promise<TickerResponse>;
  });

function formatNumber(n: number, fractionDigits = 4): string {
  if (n === 0) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatCompact(n: number): string {
  if (n === 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPercent(n: number): string {
  if (n === 0) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function TickerBar() {
  const { data, error } = useSWR<TickerResponse>("/api/ticker", fetcher, {
    refreshInterval: 300_000,
  });

  if (error) {
    return (
      <div className="border-y border-border-primary bg-bg-secondary px-6 py-3 text-xs tracking-label text-status-down">
        TICKER · OFFLINE
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border-y border-border-primary bg-bg-secondary px-6 py-3 text-xs tracking-label text-text-tertiary">
        LOADING…
      </div>
    );
  }

  // Order: market data on the left (most volatile, scanned first), network
  // health metrics in the middle, and EPOCH pinned to the right edge as the
  // permanent timestamp / "where are we in the chain" anchor.
  const items = [
    { label: "ADA", value: `$${formatNumber(data.ada.price_usd)}`, delta: formatPercent(data.ada.change_24h) },
    { label: "MCAP", value: formatCompact(data.ada.mcap_usd), delta: formatPercent(data.ada.change_24h) },
    { label: "TVL", value: formatCompact(data.tvl.cardano_usd), delta: formatPercent(data.tvl.change_24h) },
    { label: "STAKE", value: data.stake.active_percent > 0 ? `${data.stake.active_percent.toFixed(1)}%` : "—", delta: "" },
    { label: "NAKA", value: data.naka > 0 ? String(data.naka) : "—", delta: "" },
    { label: "EPOCH", value: String(data.epoch), delta: "" },
  ];

  return (
    <div className="border-y border-border-primary bg-bg-secondary">
      <div className="mx-auto flex max-w-7xl items-center gap-8 overflow-x-auto px-6 py-3 text-xs tracking-label">
        {items.map((item) => {
          const neg = item.delta.startsWith("-");
          const pos = item.delta.startsWith("+");
          const deltaColor = neg ? "text-status-down" : pos ? "text-status-up" : "text-text-tertiary";
          return (
            <div key={item.label} className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-text-tertiary">{item.label}</span>
              <span className="font-bold text-text-primary">{item.value}</span>
              {item.delta && <span className={deltaColor}>{item.delta}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
