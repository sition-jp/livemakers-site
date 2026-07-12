import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { InstrumentId } from "@/lib/home/instruments";
import type { ProvenanceState } from "@/lib/provenance/window-provenance";
import {
  normalizeFocusInstruments,
  type SessionRecord,
} from "./session-content";

const RecordSchema = z.strictObject({
  instrumentId: z.string(),
  atJst: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/),
  value: z.number().finite().positive(),
});

export type FocusSeriesRecord = z.infer<typeof RecordSchema>;

interface FocusSeriesBase {
  instrumentId: InstrumentId;
  seriesPacketId: string;
  points: { atJst: string; value: number }[];
  baseValue: number;
  lastValue: number;
  changeFromBasePct: number;
}

export type FocusSeries = FocusSeriesBase & ProvenanceState;

const FIXTURE_PATH = path.join(
  process.cwd(),
  "data",
  "home",
  "focus-series.fixture.json",
);

export function loadFocusSeriesRecords(): FocusSeriesRecord[] {
  return z
    .array(RecordSchema)
    .parse(JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")));
}

export function buildFocusSeries(
  records: FocusSeriesRecord[],
  instrumentId: InstrumentId,
  options: { windowEndJst: string },
): FocusSeries | null {
  const end = new Date(options.windowEndJst).getTime();
  const start = end - 24 * 60 * 60 * 1000;
  const points = records
    .filter((record) => record.instrumentId === instrumentId)
    .filter((record) => {
      const timestamp = new Date(record.atJst).getTime();
      return timestamp >= start && timestamp <= end;
    })
    .sort((left, right) => left.atJst.localeCompare(right.atJst))
    .filter(
      (record, index, sorted) =>
        index === sorted.length - 1 ||
        sorted[index + 1].atJst !== record.atJst,
    )
    .slice(-6);

  if (points.length < 2) {
    return null;
  }

  const baseValue = points[0].value;
  const lastValue = points.at(-1)!.value;
  return {
    instrumentId,
    seriesPacketId: `series.${options.windowEndJst.slice(0, 10)}.${instrumentId}`,
    points: points.map((point) => ({
      atJst: point.atJst,
      value: point.value,
    })),
    baseValue,
    lastValue,
    changeFromBasePct: ((lastValue - baseValue) / baseValue) * 100,
    sourceMode: "fixture_only",
    reviewStatus: "reviewed_fixture",
  };
}

export function resolveFocusInstruments(
  session: SessionRecord,
): InstrumentId[] {
  return normalizeFocusInstruments(
    session.focusInstruments,
    session.sessionSlug,
  ).instruments;
}
