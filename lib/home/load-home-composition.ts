import { cache } from "react";

import { fetchLiveMarketData } from "@/lib/terminal/live-market-feed";
import { buildHomeCompositionProps } from "./build-home-props";

export const loadHomeCompositionProps = cache(async () => {
  const feed = await fetchLiveMarketData();
  return buildHomeCompositionProps({ source: feed?.home ?? null });
});
