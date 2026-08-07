import { cache } from "react";

import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { getAllSessionRecords } from "@/lib/sessions/session-content";
import { fetchLiveMarketData } from "@/lib/terminal/live-market-feed";
import {
  buildHomeCompositionProps,
  resolveHomeRadarSource,
  type HomeRadarSource,
} from "./build-home-props";

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
  // G43-d (fix round 1): radarSource is derived outside the builder — same
  // posture as catalogSource above — so the frozen builder return object
  // never carries it. `now`/`sessionRecords` are pinned once here and threaded
  // into both calls so the label and the actually-selected radar data can
  // never drift apart.
  const now = new Date();
  const sessionRecords = getAllSessionRecords();
  const radarSource: HomeRadarSource = resolveHomeRadarSource({
    source: feed?.home ?? null,
    feedRadar: feed?.radar ?? null,
    sessionRecords,
    now,
  });
  return {
    props: buildHomeCompositionProps({
      source: feed?.home ?? null,
      feedRadar: feed?.radar ?? null,
      articles: inflow.articles,
      sessionRecords,
      now,
    }),
    catalogSource,
    radarSource,
  } as const;
});
