import { cache } from "react";

import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { fetchLiveMarketData } from "@/lib/terminal/live-market-feed";
import { buildHomeCompositionProps } from "./build-home-props";

export type HomeCatalogSource =
  | "repository_only"
  | "repository_plus_feed";

export const loadHomeCompositionProps = cache(async () => {
  const [feed, inflow] = await Promise.all([
    fetchLiveMarketData(),
    loadPublicArticleInflowCatalog(),
  ]);
  const catalogSource: HomeCatalogSource = inflow.feedPresent
    ? "repository_plus_feed"
    : "repository_only";
  return {
    props: buildHomeCompositionProps({
      source: feed?.home ?? null,
      feedRadar: feed?.radar ?? null,
      articles: inflow.articles,
    }),
    catalogSource,
  } as const;
});
