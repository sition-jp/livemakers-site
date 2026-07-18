import { describe, expect, it } from "vitest";

import {
  buildLedgerSummary,
  currentJstDate,
  deriveOverdue,
  type ForecastSnapshotState,
} from "@/lib/future-atlas/snapshot";

const EVAL = "2026-07-17";

const snapshotState = (
  id: string,
  overrides: Partial<ForecastSnapshotState> = {},
): ForecastSnapshotState => ({
  forecastId: id,
  endorsementStatus: "active",
  resolutionStatus: "open",
  resolvedByEventId: null,
  supersededByForecastId: null,
  history: [],
  dueAt: "2026-12-31",
  confidence: "base_case",
  ...overrides,
});

describe("Future Atlas ledger snapshot", () => {
  it("counts resolution states as a partition (guard #11)", () => {
    const states = [
      snapshotState("fc-open"),
      snapshotState("fc-true", { resolutionStatus: "true" }),
      snapshotState("fc-false", { resolutionStatus: "false" }),
      snapshotState("fc-indeterminate", { resolutionStatus: "indeterminate" }),
      snapshotState("fc-void", { resolutionStatus: "void" }),
    ];

    const summary = buildLedgerSummary(states, EVAL);

    expect(summary.total).toBe(
      summary.open
      + summary.trueCount
      + summary.falseCount
      + summary.indeterminate
      + summary.voidCount,
    );
    expect(summary).toMatchObject({
      total: 5,
      open: 1,
      trueCount: 1,
      falseCount: 1,
      indeterminate: 1,
      voidCount: 1,
    });
  });

  it("keeps withdrawn forecasts in denominators and counts withdrawal orthogonally", () => {
    const summary = buildLedgerSummary([
      snapshotState("fc-active"),
      snapshotState("fc-withdrawn", {
        endorsementStatus: "withdrawn",
        resolutionStatus: "false",
      }),
    ], EVAL);

    expect(summary.total).toBe(2);
    expect(summary.open).toBe(1);
    expect(summary.falseCount).toBe(1);
    expect(summary.withdrawn).toBe(1);
  });

  it("hides hit rate below ten binary resolutions and shows it at ten", () => {
    const nineBinary = Array.from({ length: 9 }, (_, index) => snapshotState(`fc-nine-${index}`, {
      resolutionStatus: index < 6 ? "true" : "false",
    }));
    const tenBinary = Array.from({ length: 10 }, (_, index) => snapshotState(`fc-ten-${index}`, {
      resolutionStatus: index < 6 ? "true" : "false",
    }));

    expect(buildLedgerSummary(nineBinary, EVAL).hitRate).toBeNull();
    expect(buildLedgerSummary(tenBinary, EVAL).hitRate).toBeCloseTo(0.6);
    expect(buildLedgerSummary(tenBinary, EVAL).binaryResolved).toBe(10);
  });

  it("derives overdue only after dueAt plus fourteen full JST dates", () => {
    const open = snapshotState("fc-open", { dueAt: "2026-07-01" });

    expect(deriveOverdue(open, "2026-07-15").overdue).toBe(false);
    expect(deriveOverdue(open, "2026-07-16").overdue).toBe(true);
    expect(deriveOverdue({ ...open, resolutionStatus: "true" }, "2026-07-16").overdue).toBe(false);
  });

  it("counts overdue as an open subset", () => {
    const summary = buildLedgerSummary([
      snapshotState("fc-overdue", { dueAt: "2026-07-01" }),
      snapshotState("fc-open", { dueAt: "2026-07-17" }),
      snapshotState("fc-resolved", { dueAt: "2026-07-01", resolutionStatus: "false" }),
    ], "2026-07-16");

    expect(summary.open).toBe(2);
    expect(summary.overdue).toBe(1);
  });

  it("warns without blocking when more than one third of open forecasts are high conviction", () => {
    const summary = buildLedgerSummary([
      snapshotState("fc-high-1", { confidence: "high_conviction" }),
      snapshotState("fc-high-2", { confidence: "high_conviction" }),
      snapshotState("fc-base-1"),
      snapshotState("fc-base-2"),
    ], EVAL);

    expect(summary.warnings).toContain("high_conviction_share_exceeded");
  });

  it("does not warn when high conviction share is exactly one third or there are no open forecasts", () => {
    const atBoundary = buildLedgerSummary([
      snapshotState("fc-high", { confidence: "high_conviction" }),
      snapshotState("fc-base-1"),
      snapshotState("fc-base-2"),
    ], EVAL);
    const noOpen = buildLedgerSummary([
      snapshotState("fc-resolved", { resolutionStatus: "true", confidence: "high_conviction" }),
    ], EVAL);

    expect(atBoundary.warnings).not.toContain("high_conviction_share_exceeded");
    expect(noOpen.warnings).not.toContain("high_conviction_share_exceeded");
  });

  it("computes non-binary resolution rate and hides it when nothing is resolved", () => {
    const mixed = [
      snapshotState("fc-t1", { resolutionStatus: "true" }),
      snapshotState("fc-t2", { resolutionStatus: "true" }),
      snapshotState("fc-f1", { resolutionStatus: "false" }),
      snapshotState("fc-f2", { resolutionStatus: "false" }),
      snapshotState("fc-i", { resolutionStatus: "indeterminate" }),
      snapshotState("fc-v", { resolutionStatus: "void" }),
    ];

    expect(buildLedgerSummary(mixed, EVAL).nonBinaryResolutionRate).toBeCloseTo(2 / 6);
    expect(buildLedgerSummary([snapshotState("fc-open")], EVAL).nonBinaryResolutionRate).toBeNull();
  });

  it("formats the current calendar date in Asia/Tokyo", () => {
    expect(currentJstDate(new Date("2026-07-17T14:59:59Z"))).toBe("2026-07-17");
    expect(currentJstDate(new Date("2026-07-17T15:00:00Z"))).toBe("2026-07-18");
  });
});
