"use client";

/**
 * DashboardFeed — client wrapper for /assets dashboard.
 *
 * Fetches /api/dashboard via SWR (60s polling) and renders 4 asset cards
 * in a 2x2 grid (collapses to 1 column on mobile).
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §7.1
 */
import useSWR from "swr";
import {
  DashboardResponseSchema,
  type DashboardResponse,
} from "@/lib/terminal/asset-summary";
import { AssetDashboardCard } from "./AssetDashboardCard";

interface DashboardFeedProps {
  initialData?: DashboardResponse | null;
}

async function fetcher(url: string): Promise<DashboardResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`dashboard ${res.status}`);
  }
  const json = await res.json();
  const parsed = DashboardResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("dashboard contract drift");
  }
  return parsed.data;
}

export function DashboardFeed({ initialData }: DashboardFeedProps) {
  const { data, error } = useSWR<DashboardResponse>("/api/dashboard", fetcher, {
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
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-lg bg-bg-secondary"
          />
        ))}
      </div>
    );
  }

  // Stable order: BTC, ETH, ADA, NIGHT (matches spec §4.2).
  const order = ["BTC", "ETH", "ADA", "NIGHT"] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {order.map((key) => (
        <AssetDashboardCard key={key} summary={data.assets[key]} />
      ))}
    </div>
  );
}
