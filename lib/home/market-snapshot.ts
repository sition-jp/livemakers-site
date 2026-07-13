import fs from "node:fs";
import path from "node:path";

import { z } from "zod";

import {
  CORE_12_INSTRUMENTS,
  LANE_ROWS,
  type InstrumentId,
} from "./instruments";

const INSTRUMENT_IDS = [
  ...CORE_12_INSTRUMENTS,
  ...LANE_ROWS.macro.map((row) => row.instrumentId),
  ...LANE_ROWS.crypto.map((row) => row.instrumentId),
  ...LANE_ROWS.rwa.map((row) => row.instrumentId),
] as [InstrumentId, ...InstrumentId[]];

export type MarketDirection = "up" | "down" | "flat";

export const MarketSnapshotCellSchema = z
  .strictObject({
    instrumentId: z.enum(INSTRUMENT_IDS),
    nameJa: z.string().min(1),
    value: z.string().min(1).nullable(),
    changeLabel: z
      .string()
      .regex(/^(?:[+-]\d+(?:\.\d+)?|0\.00)%$/)
      .nullable(),
    direction: z.enum(["up", "down", "flat"]).nullable(),
  })
  .superRefine((cell, context) => {
    const nullCount = [cell.value, cell.changeLabel, cell.direction].filter(
      (value) => value === null,
    ).length;
    if (nullCount !== 0 && nullCount !== 3) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `cell ${cell.instrumentId}: value/changeLabel/direction must be all-null or all-present`,
      });
    }

    if (nullCount !== 0) return;

    const change = Number.parseFloat(cell.changeLabel!);
    if (cell.direction === "flat" && cell.changeLabel !== "0.00%") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `cell ${cell.instrumentId}: flat requires 0.00%`,
      });
    }
    if (
      cell.direction === "up" &&
      !(change > 0 && cell.changeLabel!.startsWith("+"))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `cell ${cell.instrumentId}: up requires a positive label`,
      });
    }
    if (
      cell.direction === "down" &&
      !(change < 0 && cell.changeLabel!.startsWith("-"))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `cell ${cell.instrumentId}: down requires a negative label`,
      });
    }
  });

export const SnapshotSchema = z
  .strictObject({
    packetId: z.string().min(1),
    pagePacketId: z.string().min(1),
    asOfJst: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/),
    asOfLabel: z.string().min(1),
    dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cells: z.array(MarketSnapshotCellSchema),
  })
  .superRefine((snapshot, context) => {
    if (!snapshot.asOfJst.startsWith(snapshot.dataDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "asOfJst date must equal dataDate",
      });
    }

    const hourMinute = snapshot.asOfJst.slice(11, 16);
    if (snapshot.asOfLabel !== `${hourMinute} JST`) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "asOfLabel must equal '<hh:mm> JST' of asOfJst",
      });
    }

    const ids = snapshot.cells.map((cell) => cell.instrumentId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate instrumentId in cells",
      });
    }

    for (const instrumentId of INSTRUMENT_IDS) {
      if (!ids.includes(instrumentId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `missing cell for instrument: ${instrumentId}`,
        });
      }
    }
  });

export type MarketSnapshotCell = z.infer<typeof MarketSnapshotCellSchema>;
export type MarketSnapshot = z.infer<typeof SnapshotSchema>;

const FIXTURE_PATH = path.join(
  process.cwd(),
  "data",
  "home",
  "market-snapshot.fixture.json",
);

export function loadMarketSnapshot(): MarketSnapshot {
  return SnapshotSchema.parse(
    JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")),
  );
}

export interface SnapshotChromeMeta {
  dateLabel: string;
  asOfLabel: string;
}

const JST_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function formatJstDateLabel(dataDate: string): string {
  const weekday = JST_WEEKDAYS[new Date(`${dataDate}T00:00:00Z`).getUTCDay()];
  return `${dataDate}（${weekday}）`;
}

export function getSnapshotChromeMeta(
  snapshot: MarketSnapshot = loadMarketSnapshot(),
): SnapshotChromeMeta {
  return {
    dateLabel: formatJstDateLabel(snapshot.dataDate),
    asOfLabel: snapshot.asOfLabel,
  };
}
