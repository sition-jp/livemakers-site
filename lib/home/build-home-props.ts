import { getAllArticles } from "@/lib/articles/article-model";
import { getAllSessionRecords, getTodaySchedule } from "@/lib/sessions/session-content";
import {
  buildFocusSeries,
  loadFocusSeriesRecords,
  resolveFocusInstruments,
} from "@/lib/sessions/focus-series";
import type { MarketTickerItem } from "@/lib/terminal/market-lanes";
import { makeWindowProvenance } from "@/lib/provenance/window-provenance";
import {
  CORE_12_INSTRUMENTS,
  LANE_ROWS,
  type LaneId,
} from "./instruments";
import {
  loadMarketSnapshot,
  type MarketSnapshotCell,
} from "./market-snapshot";
import {
  RADAR_OBSERVATIONS,
  assertRadarObservationContract,
} from "./radar-observations";
import { RADAR_PROMOTIONS } from "./radar-promotions";
import { normalizeHomeInput, selectHomeSlots } from "./select-home-slots";

function cellMap(cells: MarketSnapshotCell[]) {
  return new Map(cells.map((cell) => [cell.instrumentId, cell]));
}

export function buildHomeCompositionProps(
  args: { today?: string } = {},
) {
  assertRadarObservationContract(RADAR_OBSERVATIONS);
  const snapshot = loadMarketSnapshot();
  const today = args.today ?? snapshot.dataDate;
  if (!snapshot.asOfJst.startsWith(today)) {
    throw new Error(
      `market snapshot asOfJst (${snapshot.asOfJst}) does not match today (${today})`,
    );
  }

  const raw = {
    articles: getAllArticles(),
    sessions: getAllSessionRecords(),
    radar: RADAR_OBSERVATIONS,
    promotions: RADAR_PROMOTIONS,
    today,
  };
  const normalized = normalizeHomeInput(raw);
  const live =
    normalized.sessions.find((record) => record.liveStatus === "live") ??
    null;
  const slots = selectHomeSlots(raw);
  const focusRecords = loadFocusSeriesRecords();
  const focusSeries = live
    ? resolveFocusInstruments(live).map((instrumentId) =>
        buildFocusSeries(focusRecords, instrumentId, {
          windowEndJst: snapshot.asOfJst,
        }),
      )
    : [];
  const asOfLabel = snapshot.asOfLabel;
  const pageProvenance = makeWindowProvenance({
    packetId: snapshot.pagePacketId,
    sourceMode: "fixture_only",
    reviewStatus: "reviewed_fixture",
    asOfJst: asOfLabel,
  });
  const mkt12Provenance = makeWindowProvenance({
    packetId: snapshot.packetId,
    sourceMode: "fixture_only",
    reviewStatus: "reviewed_fixture",
    asOfJst: asOfLabel,
  });
  const sessionProvenance = live
    ? makeWindowProvenance({
        packetId: live.packetId,
        sourceMode: "fixture_only",
        reviewStatus: "reviewed_fixture",
        asOfJst: `${live.asOfJst.slice(11, 16)} JST`,
      })
    : null;
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
    schedule: getTodaySchedule(today, live),
    slots,
    focusSeries,
    snapshot,
    coreCells,
    laneCells,
    tickerItems,
    pageProvenance,
    mkt12Provenance,
    sessionProvenance,
  };
}
