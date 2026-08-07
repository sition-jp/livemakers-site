import { cache } from "react";

import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { getAllSessionRecords } from "@/lib/sessions/session-content";
import { fetchLiveMarketData } from "@/lib/terminal/live-market-feed";
import {
  buildHomeCompositionProps,
  resolveHomeRadarSource,
  resolveHomeSessionsSource,
  type HomeRadarSource,
  type HomeSessionsSource,
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
  // never drift apart. feedSessions is also threaded through (fix round 1)
  // so radarSource is checked against the same merged candidate session
  // records as sessionsSource below — resolveHomeRadarSource and
  // resolveHomeSessionsSource can never disagree about whether the reviewed
  // source is adopted.
  const now = new Date();
  const sessionRecords = getAllSessionRecords();
  const radarSource: HomeRadarSource = resolveHomeRadarSource({
    source: feed?.home ?? null,
    feedRadar: feed?.radar ?? null,
    feedSessions: feed?.sessions ?? null,
    sessionRecords,
    now,
  });
  // G43-e (S2): sessionsSource is derived outside the builder — same posture
  // as radarSource above — so the frozen builder return object never carries
  // it. `now`/`sessionRecords` are the same pinned values threaded into both
  // calls so the label and the actually-selected session data can never
  // drift apart.
  const sessionsSource: HomeSessionsSource = resolveHomeSessionsSource({
    source: feed?.home ?? null,
    feedSessions: feed?.sessions ?? null,
    sessionRecords,
    now,
  });
  return {
    props: buildHomeCompositionProps({
      source: feed?.home ?? null,
      feedRadar: feed?.radar ?? null,
      feedSessions: feed?.sessions ?? null,
      articles: inflow.articles,
      sessionRecords,
      now,
    }),
    catalogSource,
    radarSource,
    sessionsSource,
  } as const;
});
