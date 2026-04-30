"use client";

/**
 * useDashboardLive — SWR hook for the live snapshot endpoint.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-30-sde-terminal-live-snapshot-v0.1.md §4.4
 *
 * Polls `/api/dashboard/live` every 30 seconds. Performs a defensive client-
 * side schema check (mirrors AssetDetailFeed's `fetcher` pattern) so a
 * contract drift surfaces visibly rather than corrupting the UI state.
 *
 * Per spec §4.2 read-only contract: this hook does not fetch CoinGecko /
 * Koios / DexScreener directly — only the materialised `/api/dashboard/live`
 * endpoint backed by `terminal_assets.live.json`.
 */
import useSWR, { type SWRResponse } from "swr";
import {
  TerminalLiveSnapshotSchema,
  type TerminalLiveSnapshot,
} from "@/lib/terminal/asset-live";

const ENDPOINT = "/api/dashboard/live";
const REFRESH_INTERVAL_MS = 30_000;
const DEDUPING_INTERVAL_MS = 10_000;

async function fetcher(url: string): Promise<TerminalLiveSnapshot> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`dashboard live ${res.status}`);
  }
  const json = await res.json();
  const parsed = TerminalLiveSnapshotSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("dashboard live contract drift");
  }
  return parsed.data;
}

export function useDashboardLive(): SWRResponse<TerminalLiveSnapshot, Error> {
  return useSWR<TerminalLiveSnapshot, Error>(ENDPOINT, fetcher, {
    refreshInterval: REFRESH_INTERVAL_MS,
    revalidateOnFocus: true,
    dedupingInterval: DEDUPING_INTERVAL_MS,
  });
}
