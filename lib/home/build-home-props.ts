import {
  getAllArticles,
  type ArticleMeta,
} from "@/lib/articles/article-model";
import {
  getAllSessionRecords,
  getTodaySchedule,
  type SessionRecord,
} from "@/lib/sessions/session-content";
import {
  buildFocusSeries,
  loadFocusSeriesRecords,
  resolveFocusInstruments,
} from "@/lib/sessions/focus-series";
import {
  makeWindowProvenance,
  selectMostConservativeProvenance,
  type WindowProvenance,
} from "@/lib/provenance/window-provenance";
import {
  formatAsOfLabel,
  type RadarFeedData,
  type ReviewedHomeData,
} from "@/lib/terminal/live-market-feed";
import type { MarketTickerItem } from "@/lib/terminal/market-lanes";
import {
  CORE_12_INSTRUMENTS,
  LANE_ROWS,
  type LaneId,
} from "./instruments";
import {
  SnapshotSchema,
  loadMarketSnapshot,
  type MarketSnapshot,
  type MarketSnapshotCell,
} from "./market-snapshot";
import type { RadarObservation } from "./radar-observations";
import { resolveTodayJst } from "./resolve-today";
import { normalizeHomeInput, selectHomeSlots } from "./select-home-slots";

/**
 * G43-d: root observability for where the home radar population came from —
 * mirrors HomeCatalogSource (data-home-catalog-source). Rendered on
 * HomeComposition's root as data-home-radar-source, without altering any
 * other returned prop.
 */
export type HomeRadarSource = "feed" | "empty" | "injected";

export interface BuildHomeCompositionArgs {
  today?: string;
  now?: Date;
  contentDir?: string;
  source?: ReviewedHomeData | null;
  /** The mapped (but not yet freshness-gated) feed `radar` bundle. */
  feedRadar?: RadarFeedData | null;
  /** Test injection — highest priority when either is provided. */
  radar?: readonly RadarObservation[];
  promotions?: Readonly<Record<string, string>>;
  sessionRecords?: SessionRecord[];
  articles?: ArticleMeta[];
  articleCutoffToday?: string;
}

const REVIEWED_HOME_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function cellMap(cells: MarketSnapshotCell[]) {
  return new Map(cells.map((cell) => [cell.instrumentId, cell]));
}

function sameInstrumentOrder(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((instrumentId, index) => instrumentId === right[index])
  );
}

function reviewedSourceMatchesSidecar(
  source: ReviewedHomeData,
  sessions: readonly SessionRecord[],
): boolean {
  const sameDateLive = sessions.find(
    (record) =>
      record.date === source.dataDate && record.liveStatus === "live",
  );
  if (!sameDateLive) return true;
  return (
    sameDateLive.sessionSlug === source.focusSession.sessionSlug &&
    sameInstrumentOrder(
      resolveFocusInstruments(sameDateLive),
      source.focusSession.focusInstruments,
    )
  );
}

function reviewedSourceIsFresh(source: ReviewedHomeData, now: Date): boolean {
  const sourceMs = Date.parse(source.asOfJst);
  const rawNowMs = now.getTime();
  if (!Number.isFinite(sourceMs) || !Number.isFinite(rawNowMs)) return false;
  const nowMs = Math.floor(rawNowMs / 1000) * 1000;
  const ageMs = nowMs - sourceMs;
  return ageMs >= 0 && ageMs <= REVIEWED_HOME_MAX_AGE_MS;
}

function buildReviewedSnapshot(
  source: ReviewedHomeData,
  fixture: MarketSnapshot,
): MarketSnapshot {
  const asOfLabel = formatAsOfLabel(source.asOfJst);
  if (!asOfLabel) throw new Error("reviewed home asOfJst is not displayable");
  const fixtureByInstrument = cellMap(fixture.cells);
  const rwaCells = LANE_ROWS.rwa.map(({ instrumentId }) => {
    const cell = fixtureByInstrument.get(instrumentId);
    if (!cell) throw new Error(`fixture is missing RWA cell: ${instrumentId}`);
    return cell;
  });
  return SnapshotSchema.parse({
    packetId: source.marketPacketId,
    pagePacketId: source.pagePacketId,
    asOfJst: source.asOfJst,
    asOfLabel,
    dataDate: source.dataDate,
    cells: [...source.cells, ...rwaCells],
  });
}

/**
 * Projects a feed-mapped radar observation down to the site-facing
 * RadarObservation shape (drops observedAtJst, the feed-only ordering
 * field select-home-slots does not need).
 */
function toRadarObservation(
  observation: RadarFeedData["observations"][number],
): RadarObservation {
  const {
    topicId,
    lane,
    titleJa,
    observedAtLabel,
    href,
    displayMode,
    publishDecision,
  } = observation;
  return { topicId, lane, titleJa, observedAtLabel, href, displayMode, publishDecision };
}

function seriesProvenance(
  series: NonNullable<ReturnType<typeof buildFocusSeries>>,
): WindowProvenance {
  const asOfJst = series.points.at(-1)!.atJst;
  return makeWindowProvenance({
    packetId: series.seriesPacketId,
    sourceMode: series.sourceMode,
    reviewStatus: series.reviewStatus,
    asOfJst:
      series.sourceMode === "reviewed_live"
        ? (formatAsOfLabel(asOfJst) ?? asOfJst)
        : asOfJst,
  } as WindowProvenance);
}

export function buildHomeCompositionProps(
  args: BuildHomeCompositionArgs = {},
) {
  const fixtureSnapshot = loadMarketSnapshot();
  const sessionRecords = args.sessionRecords ?? getAllSessionRecords();
  const now = args.now ?? new Date();
  const reviewedSource =
    args.source &&
    reviewedSourceIsFresh(args.source, now) &&
    reviewedSourceMatchesSidecar(args.source, sessionRecords)
      ? args.source
      : null;
  const snapshot = reviewedSource
    ? buildReviewedSnapshot(reviewedSource, fixtureSnapshot)
    : fixtureSnapshot;
  const reviewedAdopted = reviewedSource !== null;

  // G43-d: radar/promotions honest-empty degrade. Test injection (either key
  // explicitly provided) wins outright; otherwise the feed radar bundle is
  // only trusted once the reviewed market source itself is adopted (same
  // delivery, same freshness gate); anything else is an honest empty state
  // — RADAR_OBSERVATIONS/RADAR_PROMOTIONS are no longer supplied here.
  const radarInjected = args.radar !== undefined || args.promotions !== undefined;
  let radar: readonly RadarObservation[];
  let promotions: Readonly<Record<string, string>>;
  let radarSource: HomeRadarSource;
  if (radarInjected) {
    radar = args.radar ?? [];
    promotions = args.promotions ?? {};
    radarSource = "injected";
  } else if (reviewedAdopted && args.feedRadar) {
    radar = args.feedRadar.observations.map(toRadarObservation);
    promotions = args.feedRadar.promotions;
    radarSource = "feed";
  } else {
    radar = [];
    promotions = {};
    radarSource = "empty";
  }
  const today = args.today ?? snapshot.dataDate;
  const articleCutoffToday =
    args.articleCutoffToday ??
    (reviewedAdopted ? snapshot.dataDate : resolveTodayJst(now));
  if (!snapshot.asOfJst.startsWith(today)) {
    throw new Error(
      `market snapshot asOfJst (${snapshot.asOfJst}) does not match today (${today})`,
    );
  }

  const raw = {
    articles:
      args.articles ?? getAllArticles({ contentDir: args.contentDir }),
    sessions: sessionRecords,
    radar,
    promotions,
    today,
    articleCutoffToday,
  };
  const normalized = normalizeHomeInput(raw);
  const live =
    normalized.sessions.find((record) => record.liveStatus === "live") ??
    null;
  // P0-1b (G44 Amendment A): a session demoted by the article clock still
  // anchors the fixture focus fallback — degrade keeps fixture charts with
  // fixture provenance; only the session card drops its live claim.
  const declaredLive =
    raw.sessions.find((record) => record.liveStatus === "live") ?? null;
  const slots = selectHomeSlots(raw);
  const focusRecords = loadFocusSeriesRecords();
  const focusSeries = reviewedSource
    ? reviewedSource.focusSession.series
    : declaredLive
      ? resolveFocusInstruments(declaredLive).map((instrumentId) =>
          buildFocusSeries(focusRecords, instrumentId, {
            windowEndJst: snapshot.asOfJst,
          }),
        )
      : [];
  const focusSessionSlug = reviewedSource
    ? reviewedSource.focusSession.sessionSlug
    : (declaredLive?.sessionSlug ?? null);
  const asOfLabel = snapshot.asOfLabel;
  const reviewedPair = reviewedSource?.provenance;
  const mkt12Provenance = makeWindowProvenance({
    packetId: snapshot.packetId,
    sourceMode: reviewedPair?.sourceMode ?? "fixture_only",
    reviewStatus: reviewedPair?.reviewStatus ?? "reviewed_fixture",
    asOfJst: asOfLabel,
  } as WindowProvenance);
  const reviewedPageProvenance = reviewedSource
    ? makeWindowProvenance({
        packetId: reviewedSource.pagePacketId,
        ...reviewedSource.provenance,
        asOfJst: asOfLabel,
      })
    : null;
  const fixturePageProvenance = makeWindowProvenance({
    packetId: fixtureSnapshot.pagePacketId,
    sourceMode: "fixture_only",
    reviewStatus: "reviewed_fixture",
    asOfJst: fixtureSnapshot.asOfLabel,
  });
  const laneProvenance: Record<LaneId, WindowProvenance> = {
    macro: reviewedPageProvenance ?? fixturePageProvenance,
    crypto: reviewedPageProvenance ?? fixturePageProvenance,
    rwa: fixturePageProvenance,
  };
  const sessionProvenance = live
    ? makeWindowProvenance({
        packetId: live.packetId,
        sourceMode: "fixture_only",
        reviewStatus: "reviewed_fixture",
        asOfJst: `${live.asOfJst.slice(11, 16)} JST`,
      })
    : null;
  const visibleWindowProvenance = [
    ...(sessionProvenance ? [sessionProvenance] : []),
    ...focusSeries.filter((series) => series !== null).map(seriesProvenance),
    mkt12Provenance,
    laneProvenance.macro,
    laneProvenance.crypto,
    laneProvenance.rwa,
  ];
  const pageProvenance = selectMostConservativeProvenance(
    visibleWindowProvenance,
  );

  const byInstrument = cellMap(snapshot.cells);
  const coreCells = CORE_12_INSTRUMENTS.map(
    (instrumentId) => byInstrument.get(instrumentId)!,
  );
  const laneCells = Object.fromEntries(
    (Object.keys(LANE_ROWS) as LaneId[]).map((lane) => [
      lane,
      LANE_ROWS[lane].map(
        ({ instrumentId }) => byInstrument.get(instrumentId)!,
      ),
    ]),
  ) as Record<LaneId, MarketSnapshotCell[]>;
  const tickerItems: MarketTickerItem[] = coreCells.map((cell) => ({
    id: cell.instrumentId,
    label: cell.nameJa,
    value: cell.value ?? "—",
    deltaPct: cell.changeLabel
      ? Number.parseFloat(cell.changeLabel)
      : undefined,
    asOf: snapshot.asOfJst,
    badge: "SNAPSHOT",
  }));

  return {
    today,
    asOfLabel,
    live,
    schedule: getTodaySchedule(today, live, normalized.sessions),
    slots,
    focusSeries,
    focusSessionSlug,
    snapshot,
    coreCells,
    laneCells,
    tickerItems,
    laneProvenance,
    pageProvenance,
    mkt12Provenance,
    sessionProvenance,
    radarSource,
  };
}
