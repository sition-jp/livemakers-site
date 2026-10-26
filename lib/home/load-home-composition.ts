import { cache } from "react";

import { loadPublicArticleInflowCatalog } from "@/lib/articles/article-inflow-feed";
import { getAllSessionRecords } from "@/lib/sessions/session-content";
import {
  fetchLiveMarketData,
  requireLiveMarketData,
} from "@/lib/terminal/live-market-feed";
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

/**
 * feed windows.rwaLane の rwa.tvl tile から live 値を抽出する (2026-08-14
 * 田平氏裁定 — RWA TVL 1 行のみ live)。live と認めるのは lane badge が
 * SNAPSHOT (= 配信 payload 由来・fixture fallback は badge を欠く/FIXTURE) で
 * tile に asOfLabel が付いている時だけ。それ以外は null → RWA レーンは
 * fixture ラベルへ退避 (honest degrade)。
 */
function extractRwaLive(
  feed: Awaited<ReturnType<typeof fetchLiveMarketData>>,
): { value: string | null; deltaPct?: number; packetId: string; asOfLabel: string } | null {
  if (!feed) return null;
  const lane = feed.lanes.find((candidate) => candidate.key === "rwa");
  if (!lane || lane.badge !== "SNAPSHOT") return null;
  const tile = lane.tiles.find((candidate) => candidate.id === "rwa.tvl");
  if (!tile || !tile.asOfLabel) return null;
  const result: {
    value: string | null;
    deltaPct?: number;
    packetId: string;
    asOfLabel: string;
  } = {
    value: tile.value,
    packetId: `mext_${feed.generatedAt.slice(0, 13).replace(/[-T]/g, "")}`,
    asOfLabel: tile.asOfLabel,
  };
  if (tile.deltaPct !== undefined) result.deltaPct = tile.deltaPct;
  return result;
}

export const loadHomeCompositionProps = cache(async () => {
  // 2026-10-26 (PR-A): どちらかが実行時に取れなければエラーにして、前の正常な
  // ページを出し続ける (古い記事・見本の市場データで描いてキャッシュに残さない)
  const [marketFeed, inflow] = await Promise.all([
    fetchLiveMarketData(),
    loadPublicArticleInflowCatalog(),
  ]);
  const feed = requireLiveMarketData(marketFeed);
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
      rwaLive: extractRwaLive(feed),
      alt20: feed?.alt20 ?? null,
      articles: inflow.articles,
      sessionRecords,
      now,
    }),
    catalogSource,
    radarSource,
    sessionsSource,
  } as const;
});

/**
 * 全ページ共通の枠 (ティッカー・来歴帯・スナップショット表示) 用 (2026-10-26 PR-A)。
 * 枠の値は市場データとセッション記録だけで決まり、記事には依存しない。そこで
 * 記事カタログ (1.6MB・データキャッシュに載らない) を読まず、記事はリポジトリ内の
 * ものだけで組み立てる。layout がこれを使うことで、記事のないページも含めた全ページの
 * 作り直しのたびに起きていたカタログの取得がなくなる。
 */
export const loadChromeProps = cache(async () => {
  const feed = requireLiveMarketData(await fetchLiveMarketData());
  const props = buildHomeCompositionProps({
    source: feed?.home ?? null,
    feedRadar: feed?.radar ?? null,
    feedSessions: feed?.sessions ?? null,
    rwaLive: extractRwaLive(feed),
    alt20: feed?.alt20 ?? null,
    sessionRecords: getAllSessionRecords(),
    now: new Date(),
  });
  return {
    tickerItems: props.tickerItems,
    pageProvenance: props.pageProvenance,
    snapshot: props.snapshot,
  } as const;
});
