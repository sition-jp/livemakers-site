import { NextResponse } from "next/server";
import { TickerCache } from "@/lib/server/ticker-cache";
import type { TickerResponse } from "@/lib/types";

const cache = new TickerCache(300);

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
  const res = await fetch("https://api.llama.fi/tvl/cardano");
  if (!res.ok) throw new Error(`DefiLlama ${res.status}`);
  return res.json();
}

async function fetchKoiosEpoch(): Promise<number> {
  const res = await fetch("https://api.koios.rest/api/v1/tip");
  if (!res.ok) throw new Error(`Koios ${res.status}`);
  const data = (await res.json()) as Array<{ epoch_no: number }>;
  return data[0]?.epoch_no ?? 0;
}

export async function GET() {
  try {
    const [coingecko, tvl, epoch] = await Promise.all([
      cache.get("coingecko", fetchCoinGecko),
      cache.get("tvl", fetchCardanoTvl),
      cache.get("epoch", fetchKoiosEpoch),
    ]);

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
        active_percent: 0,
      },
      epoch,
      naka: 0,
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(body, {
      headers: { "cache-control": "public, max-age=60" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "ticker unavailable", detail: String(err) },
      { status: 503 }
    );
  }
}
