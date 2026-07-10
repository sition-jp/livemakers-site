import { describe, expect, it } from "vitest";

import { RADAR_PROMOTIONS } from "@/lib/home/radar-promotions";
import {
  RADAR_OBSERVATIONS,
  RadarObservationSchema,
  assertRadarObservationContract,
} from "@/lib/home/radar-observations";

describe("radar strict title-only contract", () => {
  it("carries href=null, title_only, and not_authorized", () => {
    expect(() =>
      assertRadarObservationContract(RADAR_OBSERVATIONS),
    ).not.toThrow();
    for (const observation of RADAR_OBSERVATIONS) {
      expect(observation.href).toBeNull();
      expect(observation.displayMode).toBe("title_only");
      expect(observation.publishDecision).toBe("not_authorized");
    }
  });

  it("rejects visible internal text and duplicate topic ids", () => {
    expect(() =>
      assertRadarObservationContract([
        {
          ...RADAR_OBSERVATIONS[0],
          titleJa: "published_log の更新を検出",
        },
      ]),
    ).toThrow(/forbidden internal text/);
    expect(() =>
      assertRadarObservationContract([
        RADAR_OBSERVATIONS[0],
        {
          ...RADAR_OBSERVATIONS[1],
          topicId: RADAR_OBSERVATIONS[0].topicId,
        },
      ]),
    ).toThrow(/duplicate radar topicId/);
  });

  it("rejects forbidden payload keys", () => {
    for (const extra of [
      { body: "本文" },
      { url: "https://x.com/a/status/1" },
      { excerpt: "抜粋" },
      { promotedArticleId: "signal-x" },
      { sourceXUrl: "https://x.com/a/status/1" },
    ]) {
      expect(() =>
        RadarObservationSchema.parse({
          ...RADAR_OBSERVATIONS[0],
          ...extra,
        }),
      ).toThrow();
    }
  });

  it("keeps promotion association outside the payload", () => {
    expect(RADAR_PROMOTIONS.stablecoin_supply_20260710).toBe(
      "signal-stablecoin-supply-2026-07-10",
    );
    expect(Object.keys(RADAR_OBSERVATIONS[0])).not.toContain(
      "promotedArticleId",
    );
  });
});
