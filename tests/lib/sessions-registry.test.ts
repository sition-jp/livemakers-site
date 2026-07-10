import { describe, expect, it } from "vitest";

import {
  READER_SESSIONS,
  getSessionBySlug,
} from "@/lib/sessions/session-registry";

describe("session registry v2 (G40 verbatim)", () => {
  it("defines exactly the four G40 reader sessions in daily order", () => {
    expect(READER_SESSIONS.map((session) => session.slug)).toEqual([
      "asia-open",
      "europe-bridge",
      "ny-open",
      "global-close",
    ]);
    expect(READER_SESSIONS.map((session) => session.nameEn)).toEqual([
      "Asia Open Terminal",
      "Europe Bridge Terminal",
      "NY Open Terminal",
      "Global Close / Frontier Terminal",
    ]);
    expect(READER_SESSIONS.map((session) => session.updateTimeLabel)).toEqual([
      "05:03",
      "12:03",
      "18:03",
      "22:33–23:03",
    ]);
    expect(READER_SESSIONS.map((session) => session.internalSlot)).toEqual([
      "morning",
      "midday",
      "evening",
      "night",
    ]);
  });

  it("keeps default focus instruments inside the chartable set and sized 2", () => {
    for (const session of READER_SESSIONS) {
      expect(session.defaultFocusInstruments).toHaveLength(2);
    }
    expect(getSessionBySlug("asia-open").defaultFocusInstruments).toEqual([
      "nikkei_futures",
      "usd_jpy",
    ]);
    expect(getSessionBySlug("ny-open").defaultFocusInstruments).toEqual([
      "spx",
      "us10y",
    ]);
  });
});
