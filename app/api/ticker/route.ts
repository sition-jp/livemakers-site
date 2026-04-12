import { NextResponse } from "next/server";
import { TickerCache } from "@/lib/server/ticker-cache";
import type { TickerResponse } from "@/lib/types";

// Short cache for fast-changing market data (price, TVL, epoch, stake %).
const cache = new TickerCache(300); // 5 min

// Long cache for the expensive Nakamoto coefficient computation. The
// underlying value only changes when stake distribution shifts noticeably,
// which happens slowly across epochs. Refreshing every 6 hours keeps it
// fresh enough while bounding cold-start latency to one slow request per
// process per 6h window.
const slowCache = new TickerCache(21_600); // 6 hours

interface CoinGeckoResponse {
  cardano: {
    usd: number;
    usd_24h_change: number;
    usd_market_cap: number;
  };
}

async function fetchCoinGecko(): Promise<CoinGeckoResponse> {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd&include_market_cap=true&include_24hr_change=true";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json();
}

async function fetchCardanoTvl(): Promise<number> {
  // /tvl/{chain} was deprecated; use /v2/chains and filter by name.
  const res = await fetch("https://api.llama.fi/v2/chains");
  if (!res.ok) throw new Error(`DefiLlama ${res.status}`);
  const chains = (await res.json()) as Array<{ name: string; tvl: number }>;
  const cardano = chains.find((c) => c.name === "Cardano");
  if (!cardano) throw new Error("DefiLlama: Cardano not in chains list");
  return cardano.tvl;
}

async function fetchKoiosEpoch(): Promise<number> {
  const res = await fetch("https://api.koios.rest/api/v1/tip");
  if (!res.ok) throw new Error(`Koios ${res.status}`);
  const data = (await res.json()) as Array<{ epoch_no: number }>;
  return data[0]?.epoch_no ?? 0;
}

/**
 * Active stake as a percentage of circulating supply.
 *
 * Source: Koios /epoch_info active_stake (lovelace, current epoch) divided
 * by /totals circulation (lovelace). Both endpoints return scalar lovelace
 * values; we compute the ratio in JS.
 *
 * Returns 0 on failure (UI will render "—" for that column).
 */
async function fetchKoiosStakePercent(): Promise<number> {
  // Get current epoch first so we query epoch_info for the right epoch.
  const tipRes = await fetch("https://api.koios.rest/api/v1/tip");
  if (!tipRes.ok) throw new Error(`Koios tip ${tipRes.status}`);
  const tip = (await tipRes.json()) as Array<{ epoch_no: number }>;
  const epoch = tip[0]?.epoch_no;
  if (!epoch) throw new Error("Koios tip: missing epoch_no");

  const [epochInfoRes, totalsRes] = await Promise.all([
    fetch(
      `https://api.koios.rest/api/v1/epoch_info?_epoch_no=${epoch}&select=active_stake`
    ),
    fetch(
      `https://api.koios.rest/api/v1/totals?_epoch_no=${epoch}&select=circulation`
    ),
  ]);
  if (!epochInfoRes.ok)
    throw new Error(`Koios epoch_info ${epochInfoRes.status}`);
  if (!totalsRes.ok) throw new Error(`Koios totals ${totalsRes.status}`);

  const epochInfo = (await epochInfoRes.json()) as Array<{
    active_stake: string;
  }>;
  const totals = (await totalsRes.json()) as Array<{ circulation: string }>;

  const activeStake = BigInt(epochInfo[0]?.active_stake ?? "0");
  const circulation = BigInt(totals[0]?.circulation ?? "0");
  if (circulation === 0n) return 0;

  // Use Number for the final ratio — both values are well within safe range
  // when compared as ratios (max ~46 / 36 ≈ 1.3).
  const ratio = Number(activeStake) / Number(circulation);
  return ratio * 100;
}

/**
 * Nakamoto coefficient at the pool level.
 *
 * Defined as the minimum number of independent stake pools that would have
 * to collude to control more than 50% of active stake. Computed by:
 *   1) Fetching all pools from Koios /pool_list (paginated, parallel).
 *   2) Filtering to pools with non-zero active_stake.
 *   3) Sorting numerically descending.
 *   4) Accumulating stake until the running total exceeds 50% of the sum,
 *      and returning the index + 1.
 *
 * Note: this is the POOL-level coefficient, not the operator-grouped one
 * commonly cited in cross-chain comparisons (which groups multi-pool
 * operators like Binance into a single entity). Operator grouping requires
 * an external mapping and is deferred to v0.2.
 *
 * Performance: 7 parallel HTTP calls (~5s wall clock) returning ~6k pools.
 * Cached in slowCache (6h TTL) so the cold-path latency hits at most once
 * per 6h window.
 *
 * Returns 0 on failure (UI will render "—" for that column).
 */
async function fetchKoiosNakamoto(): Promise<number> {
  // Koios /pool_list returns at most 1000 rows per call. Fetch 7 parallel
  // pages (offset 0..6000) which covers the current ~6,100 registered pools
  // with headroom.
  const offsets = [0, 1000, 2000, 3000, 4000, 5000, 6000];
  const pages = await Promise.all(
    offsets.map(async (offset) => {
      const res = await fetch(
        `https://api.koios.rest/api/v1/pool_list?select=active_stake&offset=${offset}&limit=1000`
      );
      if (!res.ok) throw new Error(`Koios pool_list ${res.status}`);
      return (await res.json()) as Array<{ active_stake: string | null }>;
    })
  );

  const stakes: bigint[] = [];
  for (const page of pages) {
    for (const row of page) {
      if (row.active_stake && row.active_stake !== "0") {
        stakes.push(BigInt(row.active_stake));
      }
    }
  }
  if (stakes.length === 0) return 0;

  stakes.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const total = stakes.reduce((s, x) => s + x, 0n);
  const threshold = total / 2n;
  let acc = 0n;
  for (let i = 0; i < stakes.length; i++) {
    acc += stakes[i];
    if (acc > threshold) return i + 1;
  }
  return stakes.length;
}

export async function GET() {
  const [coingeckoRes, tvlRes, epochRes, stakeRes, nakaRes] =
    await Promise.allSettled([
      cache.get("coingecko", fetchCoinGecko),
      cache.get("tvl", fetchCardanoTvl),
      cache.get("epoch", fetchKoiosEpoch),
      cache.get("stake_percent", fetchKoiosStakePercent),
      slowCache.get("nakamoto", fetchKoiosNakamoto),
    ]);

  // If CoinGecko (primary price source) fails, the ticker is unusable.
  if (coingeckoRes.status !== "fulfilled") {
    console.error("[ticker] CoinGecko failed:", coingeckoRes.reason);
    return NextResponse.json(
      { error: "ticker unavailable" },
      { status: 503 }
    );
  }

  if (tvlRes.status !== "fulfilled") {
    console.error("[ticker] DefiLlama failed:", tvlRes.reason);
  }
  if (epochRes.status !== "fulfilled") {
    console.error("[ticker] Koios epoch failed:", epochRes.reason);
  }
  if (stakeRes.status !== "fulfilled") {
    console.error("[ticker] Koios stake failed:", stakeRes.reason);
  }
  if (nakaRes.status !== "fulfilled") {
    console.error("[ticker] Koios nakamoto failed:", nakaRes.reason);
  }

  const coingecko = coingeckoRes.value;
  const tvl = tvlRes.status === "fulfilled" ? tvlRes.value : 0;
  const epoch = epochRes.status === "fulfilled" ? epochRes.value : 0;
  const stakePercent = stakeRes.status === "fulfilled" ? stakeRes.value : 0;
  const naka = nakaRes.status === "fulfilled" ? nakaRes.value : 0;

  const body: TickerResponse = {
    ada: {
      price_usd: coingecko.cardano.usd,
      change_24h: coingecko.cardano.usd_24h_change,
      mcap_usd: coingecko.cardano.usd_market_cap,
    },
    tvl: {
      cardano_usd: tvl,
      change_24h: 0,
    },
    stake: {
      active_percent: stakePercent,
    },
    epoch,
    naka,
    updated_at: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    headers: { "cache-control": "public, max-age=60" },
  });
}
