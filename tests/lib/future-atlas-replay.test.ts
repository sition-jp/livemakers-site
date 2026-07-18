import { describe, expect, it } from "vitest";

import { replayForecast } from "@/lib/future-atlas/replay";
import type { ForecastEvent } from "@/lib/future-atlas/schema";

type ResolutionStatus = "true" | "false" | "indeterminate" | "void";

const resolutionEvent = (
  forecastId: string,
  resolutionStatus: ResolutionStatus,
  overrides: Partial<Extract<ForecastEvent, { type: "resolution" }>> = {},
): Extract<ForecastEvent, { type: "resolution" }> => ({
  type: "resolution",
  eventId: "ev-resolution",
  date: "2027-06-30",
  forecastId,
  articleId: "future-map-resolution",
  materials: ["https://example.com/evidence"],
  resolutionStatus,
  decidedBy: "tabira",
  ...overrides,
});

const correctionEvent = (
  forecastId: string,
  overrides: Partial<Extract<ForecastEvent, { type: "resolution_correction" }>> = {},
): Extract<ForecastEvent, { type: "resolution_correction" }> => ({
  type: "resolution_correction",
  eventId: "ev-correction",
  date: "2027-07-01",
  forecastId,
  materials: ["https://example.com/correction-evidence"],
  supersedesEventId: "ev-resolution",
  resolutionStatus: "false",
  reason: "訂正",
  correctionArticleId: "future-map-correction",
  decidedBy: "tabira",
  secondReview: {
    reviewer: "reviewer",
    reviewedAt: "2027-07-01",
    reviewDecision: "agree",
    reviewNote: "確認済み",
  },
  correctedAt: "2027-07-01",
  ...overrides,
});

const withdrawnEvent = (forecastId: string): Extract<ForecastEvent, { type: "endorsement_withdrawn" }> => ({
  type: "endorsement_withdrawn",
  eventId: "ev-withdrawn",
  date: "2027-06-29",
  forecastId,
  note: "見解を撤回",
  materials: [],
});

describe("Future Atlas forecast replay", () => {
  it("resolves open -> true via a resolution event (guard #5 allowlist)", () => {
    const state = replayForecast("fc-a", [resolutionEvent("fc-a", "true")]);

    expect(state.resolutionStatus).toBe("true");
    expect(state.resolvedByEventId).toBe("ev-resolution");
  });

  it("rejects a second direct resolution (guard #5)", () => {
    expect(() => replayForecast("fc-a", [
      resolutionEvent("fc-a", "true", { eventId: "ev-r1" }),
      resolutionEvent("fc-a", "false", { eventId: "ev-r2" }),
    ])).toThrow(/already resolved/);
  });

  it("applies a correction chain and preserves every original event in input order", () => {
    const resolution = resolutionEvent("fc-a", "true", { eventId: "ev-r1" });
    const correction = correctionEvent("fc-a", {
      eventId: "ev-c1",
      supersedesEventId: "ev-r1",
      resolutionStatus: "false",
    });
    const finalCorrection = correctionEvent("fc-a", {
      eventId: "ev-c2",
      supersedesEventId: "ev-c1",
      resolutionStatus: "void",
    });
    const state = replayForecast("fc-a", [resolution, correction, finalCorrection]);

    expect(state.resolutionStatus).toBe("void");
    expect(state.resolvedByEventId).toBe("ev-c2");
    expect(state.history).toEqual([resolution, correction, finalCorrection]);
  });

  it("rejects corrections of nonexistent targets and cyclic correction chains (guard #5)", () => {
    expect(() => replayForecast("fc-a", [
      correctionEvent("fc-a", { supersedesEventId: "ev-missing" }),
    ])).toThrow(/supersed.*existing resolution/i);

    expect(() => replayForecast("fc-a", [
      resolutionEvent("fc-a", "true", { eventId: "ev-r1" }),
      correctionEvent("fc-a", { eventId: "ev-c1", supersedesEventId: "ev-c2" }),
      correctionEvent("fc-a", { eventId: "ev-c2", supersedesEventId: "ev-c1" }),
    ])).toThrow(/cyclic/i);
  });

  it("only permits corrections to resolution events", () => {
    const evidence: Extract<ForecastEvent, { type: "evidence_added" }> = {
      type: "evidence_added",
      eventId: "ev-evidence",
      date: "2027-06-30",
      forecastId: "fc-a",
      materials: [],
    };

    expect(() => replayForecast("fc-a", [
      evidence,
      correctionEvent("fc-a", { supersedesEventId: "ev-evidence" }),
    ])).toThrow(/existing resolution/i);
  });

  it("requires a correction to supersede an earlier event in the replay history", () => {
    expect(() => replayForecast("fc-a", [
      correctionEvent("fc-a", { eventId: "ev-c1", supersedesEventId: "ev-r1" }),
      resolutionEvent("fc-a", "true", { eventId: "ev-r1" }),
    ])).toThrow(/existing resolution/i);
  });

  it("keeps withdrawn forecasts resolvable (§7.1)", () => {
    const state = replayForecast("fc-a", [
      withdrawnEvent("fc-a"),
      resolutionEvent("fc-a", "false"),
    ]);

    expect(state.endorsementStatus).toBe("withdrawn");
    expect(state.resolutionStatus).toBe("false");
  });

  it("allows endorsement to move from active to withdrawn only once", () => {
    expect(() => replayForecast("fc-a", [
      withdrawnEvent("fc-a"),
      { ...withdrawnEvent("fc-a"), eventId: "ev-withdrawn-again" },
    ])).toThrow(/already withdrawn/i);
  });

  it("keeps metadata corrections in history without changing forecast state", () => {
    const metadata: Extract<ForecastEvent, { type: "metadata_correction" }> = {
      type: "metadata_correction",
      eventId: "ev-metadata",
      date: "2027-07-01",
      articleId: "future-map-resolution",
      field: "themes",
      before: ["ai"],
      after: ["ai", "finance"],
      reason: "棚移動",
      materials: [],
    };
    const state = replayForecast("fc-a", [metadata], "future-map-resolution");

    expect(state).toMatchObject({
      forecastId: "fc-a",
      endorsementStatus: "active",
      resolutionStatus: "open",
      resolvedByEventId: null,
      supersededByForecastId: null,
    });
    expect(state.history).toEqual([metadata]);
  });

  it("isolates each forecast history while retaining metadata corrections for its article", () => {
    const resolutionA = resolutionEvent("fc-a", "true", { eventId: "ev-a" });
    const resolutionB = resolutionEvent("fc-b", "false", { eventId: "ev-b" });
    const metadataA: Extract<ForecastEvent, { type: "metadata_correction" }> = {
      type: "metadata_correction",
      eventId: "ev-meta-a",
      date: "2027-07-01",
      articleId: "future-map-a",
      field: "themes",
      before: ["ai"],
      after: ["ai", "finance"],
      reason: "棚移動",
      materials: [],
    };
    const metadataB = {
      ...metadataA,
      eventId: "ev-meta-b",
      articleId: "future-map-b",
      forecastId: "fc-a",
    };

    const state = replayForecast(
      "fc-a",
      [resolutionA, resolutionB, metadataA, metadataB],
      "future-map-a",
    );

    expect(state.history.map((event) => event.eventId)).toEqual(["ev-a", "ev-meta-a"]);
  });

  it("retains the immutable event snapshot when an update supersedes the forecast", () => {
    const update: Extract<ForecastEvent, { type: "update" }> = {
      type: "update",
      eventId: "ev-update",
      date: "2027-07-01",
      forecastId: "fc-a",
      note: "後継予測を発行",
      materials: [],
      supersededByForecastId: "fc-b",
    };
    const state = replayForecast("fc-a", [
      resolutionEvent("fc-a", "true", { eventId: "ev-r1" }),
      update,
    ]);

    expect(state.supersededByForecastId).toBe("fc-b");
    expect(state.resolutionStatus).toBe("true");
    expect(state.history[1]).toEqual(update);
  });
});
