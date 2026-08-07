import {
  getAllArticles,
  type ArticleMeta,
} from "@/lib/articles/article-model";
import {
  getAllSessionRecords,
  getTodaySchedule,
  normalizeFocusInstruments,
  type SessionRecord,
  type SessionRecordMeta,
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
  type SessionsFeedData,
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
  /** The mapped (but not yet freshness-gated) feed `sessions` bundle. */
  feedSessions?: SessionsFeedData | null;
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

/**
 * G43-e (S2): root observability for where the "いまのセッション" panel's live
 * record came from — same mirrored posture as HomeRadarSource /
 * HomeCatalogSource. Rendered on HomeComposition's root as
 * data-home-sessions-source, without altering any other returned prop.
 */
export type HomeSessionsSource = "feed_today" | "repo";

/**
 * G43-e (S2): lifts a validated feed session record (the wire shape,
 * SessionRecordMeta) to the site-facing SessionRecord shape used everywhere
 * else on the home page. bodyJa is always null (feed sessions never carry an
 * article body — crystallize, materializing a feed session into a repo
 * content/sessions/ directory, is a separate not-yet-wired gate) and
 * focusFallbackApplied is always false — normalizeFocusInstruments is reused
 * only for its string[] -> InstrumentId[] narrowing, not for its fallback
 * signal, since the wire contract's reused SessionMetaSchema already
 * guarantees the record is otherwise well-formed.
 */
function toSessionRecord(meta: SessionRecordMeta): SessionRecord {
  const { instruments } = normalizeFocusInstruments(
    meta.focusInstruments,
    meta.sessionSlug,
  );
  return {
    ...meta,
    focusInstruments: instruments,
    focusFallbackApplied: false,
    bodyJa: null,
  };
}

/**
 * Merges today's feed session records into the repo sidecar list. The feed
 * wins on a sessionId collision (the repo row is dropped); the merged list is
 * re-sorted newest-first to preserve getAllSessionRecords()'s existing
 * invariant, which downstream .find() callers rely on (the live-record
 * lookup, and per-slug "previous" resolution in getTodaySchedule).
 */
function mergeSessionRecords(
  feedRecords: readonly SessionRecordMeta[],
  repoRecords: readonly SessionRecord[],
): SessionRecord[] {
  const feedIds = new Set(feedRecords.map((record) => record.sessionId));
  const feedSessionRecords = feedRecords.map(toSessionRecord);
  const dedupedRepo = repoRecords.filter(
    (record) => !feedIds.has(record.sessionId),
  );
  return [...feedSessionRecords, ...dedupedRepo].sort((left, right) =>
    right.asOfJst.localeCompare(left.asOfJst),
  );
}

/**
 * G43-e (fix round 1): the single "which session records should the reviewed
 * source be checked against" computation — used by resolveHomeRadarSource,
 * resolveHomeSessionsSource, AND buildHomeCompositionProps itself. Before
 * this fix, resolveHomeRadarSource read the *plain* (unmerged) sessionRecords
 * while resolveHomeSessionsSource/the builder read the merged
 * (feed + repo) records, so a feed sessions bundle whose live record
 * disagreed with the reviewed home packet's focusSession could flip
 * sessionsSource to "repo" while radarSource still said "feed" — a
 * self-contradictory page. All three call sites now derive the same
 * candidate list from the same (feedSessions, sessionRecords) pair.
 */
function deriveCandidateSessionRecords(
  feedSessions: SessionsFeedData | null | undefined,
  sessionRecords: SessionRecord[],
): SessionRecord[] {
  const feedSessionMetas = feedSessions?.records ?? [];
  if (feedSessionMetas.length === 0) return sessionRecords;
  return mergeSessionRecords(feedSessionMetas, sessionRecords);
}

/**
 * G43-e (fix round 1): the single "is the reviewed home packet adopted"
 * predicate, shared by resolveHomeRadarSource, resolveHomeSessionsSource, and
 * buildHomeCompositionProps' own reviewedSource computation — freshness +
 * sidecar-match against whatever candidate session records the caller
 * derived (see deriveCandidateSessionRecords).
 */
function isReviewedSourceAdopted(
  source: ReviewedHomeData | null | undefined,
  candidateSessionRecords: readonly SessionRecord[],
  now: Date,
): boolean {
  return (
    !!source &&
    reviewedSourceIsFresh(source, now) &&
    reviewedSourceMatchesSidecar(source, candidateSessionRecords)
  );
}

/**
 * G43-d (fix round 1): resolves the radar rail's observability label using
 * the exact same reviewed-source adoption predicate buildHomeCompositionProps
 * uses internally to pick `radar`/`promotions` — extracted to a single
 * exported function so the two call sites (the builder itself, and
 * load-home-composition.ts computing it outside the frozen builder return
 * — same posture as HomeCatalogSource) can never drift apart. `feedSessions`
 * (optional) lets the adoption check run against the same merged candidate
 * session records resolveHomeSessionsSource uses — see
 * deriveCandidateSessionRecords — so radarSource and sessionsSource can never
 * disagree about whether the reviewed source is adopted.
 */
export function resolveHomeRadarSource(args: {
  source?: ReviewedHomeData | null;
  feedRadar?: RadarFeedData | null;
  feedSessions?: SessionsFeedData | null;
  radar?: readonly RadarObservation[];
  promotions?: Readonly<Record<string, string>>;
  sessionRecords?: SessionRecord[];
  now?: Date;
}): HomeRadarSource {
  const radarInjected =
    args.radar !== undefined || args.promotions !== undefined;
  if (radarInjected) return "injected";
  const sessionRecords = args.sessionRecords ?? getAllSessionRecords();
  const now = args.now ?? new Date();
  const candidateSessionRecords = deriveCandidateSessionRecords(
    args.feedSessions,
    sessionRecords,
  );
  const reviewedAdopted = isReviewedSourceAdopted(
    args.source,
    candidateSessionRecords,
    now,
  );
  if (reviewedAdopted && args.feedRadar) return "feed";
  return "empty";
}

/**
 * G43-e (S2): resolves the sessions rail's observability label using the
 * exact same reviewed-source adoption predicate buildHomeCompositionProps
 * uses internally to pick the effective session records — same "call sites
 * can never drift apart" posture as resolveHomeRadarSource (G43-d fix round
 * 1). The merge candidate fed into isReviewedSourceAdopted here is a pure
 * function of (feedSessions, sessionRecords) — see
 * deriveCandidateSessionRecords — so recomputing it with identical inputs
 * inside buildHomeCompositionProps always yields an identical conclusion —
 * no duplicated adoption logic, only a duplicated (pure, deterministic)
 * merge.
 */
export function resolveHomeSessionsSource(args: {
  source?: ReviewedHomeData | null;
  feedSessions?: SessionsFeedData | null;
  sessionRecords?: SessionRecord[];
  now?: Date;
}): HomeSessionsSource {
  const sessionRecords = args.sessionRecords ?? getAllSessionRecords();
  const now = args.now ?? new Date();
  if ((args.feedSessions?.records ?? []).length === 0) return "repo";
  const candidateSessionRecords = deriveCandidateSessionRecords(
    args.feedSessions,
    sessionRecords,
  );
  const reviewedAdopted = isReviewedSourceAdopted(
    args.source,
    candidateSessionRecords,
    now,
  );
  return reviewedAdopted ? "feed_today" : "repo";
}

export function buildHomeCompositionProps(
  args: BuildHomeCompositionArgs = {},
) {
  const fixtureSnapshot = loadMarketSnapshot();
  const sessionRecords = args.sessionRecords ?? getAllSessionRecords();
  const now = args.now ?? new Date();

  // G43-e (S2) / fix round 1: speculative merge — feed session records
  // (today, pending-only; enforced upstream by live-market-feed.ts's
  // fail-closed wire contract) replace any same-sessionId repo row BEFORE
  // reviewedSourceMatchesSidecar runs, so a feed-declared newer live session
  // can (dis)confirm the reviewed market source exactly like a crystallized
  // repo session would. deriveCandidateSessionRecords is a pure function of
  // (feedSessions, sessionRecords) — this is byte-for-byte what
  // resolveHomeRadarSource / resolveHomeSessionsSource compute internally for
  // the same args, so reviewedAdopted, radarSource, and sessionsSource can
  // never disagree with each other even though the latter two are derived by
  // calling those exported functions rather than by re-deriving the result
  // inline.
  const candidateSessionRecords = deriveCandidateSessionRecords(
    args.feedSessions,
    sessionRecords,
  );

  const reviewedSource = isReviewedSourceAdopted(
    args.source,
    candidateSessionRecords,
    now,
  )
    ? (args.source ?? null)
    : null;
  const snapshot = reviewedSource
    ? buildReviewedSnapshot(reviewedSource, fixtureSnapshot)
    : fixtureSnapshot;
  const reviewedAdopted = reviewedSource !== null;

  // sessionsSource itself is NOT part of this function's return value (same
  // frozen-return posture as radarSource, G44 D13) — resolveHomeSessionsSource
  // is the single source of truth callers outside the builder use to derive
  // the same label (see load-home-composition.ts).
  const sessionsSource: HomeSessionsSource = resolveHomeSessionsSource({
    source: args.source,
    feedSessions: args.feedSessions,
    sessionRecords,
    now,
  });
  const effectiveSessionRecords =
    sessionsSource === "feed_today" ? candidateSessionRecords : sessionRecords;

  // G43-d: radar/promotions honest-empty degrade. Test injection (either key
  // explicitly provided) wins outright; otherwise the feed radar bundle is
  // only trusted once the reviewed market source itself is adopted (same
  // delivery, same freshness gate); anything else is an honest empty state
  // — RADAR_OBSERVATIONS/RADAR_PROMOTIONS are no longer supplied here.
  // radarSource itself is NOT part of this function's return value (G44 D13
  // frozen top-level key set) — resolveHomeRadarSource is the single source
  // of truth callers outside the builder use to derive the same label.
  // feedSessions is threaded through (fix round 1) so this internal call
  // adopts against the same merged candidateSessionRecords as sessionsSource
  // above — see resolveHomeRadarSource's doc comment.
  const radarSource = resolveHomeRadarSource({
    source: args.source,
    feedRadar: args.feedRadar,
    feedSessions: args.feedSessions,
    radar: args.radar,
    promotions: args.promotions,
    sessionRecords,
    now,
  });
  let radar: readonly RadarObservation[];
  let promotions: Readonly<Record<string, string>>;
  if (radarSource === "injected") {
    radar = args.radar ?? [];
    promotions = args.promotions ?? {};
  } else if (radarSource === "feed") {
    radar = args.feedRadar!.observations.map(toRadarObservation);
    promotions = args.feedRadar!.promotions;
  } else {
    radar = [];
    promotions = {};
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
    sessions: effectiveSessionRecords,
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
  };
}
