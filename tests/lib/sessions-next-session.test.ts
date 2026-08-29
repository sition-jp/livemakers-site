import { describe, expect, it } from "vitest";

import {
  countRemainingSessions,
  resolveNextSession,
} from "@/lib/sessions/next-session";

// 2026-08-23 田平氏 GO (spec: docs/superpowers/specs/2026-08-23-terminal-switching-ux-design.md §B):
// 「次の更新」「本日あと N 回更新」は時計ベース。JST の HH:MM を registry の
// updateTimeLabel と比較する — 観測 RED でセッションが無い日に過ぎた時刻を
// 「次」と言い続けない。
describe("resolveNextSession (clock-based, JST)", () => {
  it("picks the first anchor strictly after now", () => {
    const next = resolveNextSession(new Date("2026-08-23T13:40:00+09:00"));
    expect(next.def.slug).toBe("ny-open");
    expect(next.date).toBe("today");
  });

  it("treats the anchor minute itself as already started (12:03 -> next is 18:03)", () => {
    const next = resolveNextSession(new Date("2026-08-23T12:03:00+09:00"));
    expect(next.def.slug).toBe("ny-open");
  });

  it("returns the first anchor just before it fires (12:02 -> 12:03)", () => {
    const next = resolveNextSession(new Date("2026-08-23T12:02:59+09:00"));
    expect(next.def.slug).toBe("europe-bridge");
    expect(next.date).toBe("today");
  });

  it("wraps to tomorrow's asia-open after the last anchor", () => {
    const next = resolveNextSession(new Date("2026-08-23T23:30:00+09:00"));
    expect(next.def.slug).toBe("asia-open");
    expect(next.date).toBe("tomorrow");
  });

  it("uses JST, not the runtime zone (UTC 20:00 = JST 05:00 next day)", () => {
    const next = resolveNextSession(new Date("2026-08-23T20:00:00Z"));
    expect(next.def.slug).toBe("asia-open");
    expect(next.date).toBe("today");
  });
});

describe("countRemainingSessions (clock-based, JST)", () => {
  it("counts anchors still ahead today", () => {
    expect(countRemainingSessions(new Date("2026-08-23T13:40:00+09:00"))).toBe(2);
    expect(countRemainingSessions(new Date("2026-08-23T08:00:00+09:00"))).toBe(3);
    expect(countRemainingSessions(new Date("2026-08-23T04:00:00+09:00"))).toBe(4);
    expect(countRemainingSessions(new Date("2026-08-23T23:30:00+09:00"))).toBe(0);
  });
});
