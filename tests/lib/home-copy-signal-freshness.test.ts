import { describe, expect, it } from "vitest";

import { buildTestHomeCopy } from "@/lib/home/home-copy";

describe("home copy: signal freshness (2026-08-23 田平氏 GO B-1 追加提案 1)", () => {
  it("formats today's count and the latest stamp from the context", () => {
    const copy = buildTestHomeCopy({ signalTodayCount: 6, signalLatestAt: "08-22 19:53" });
    expect(copy.gradient.signalFreshness).toEqual({
      todayCount: "今日 6 本",
      latestAt: "最新 08-22 19:53",
    });
  });

  it("drops the segments honestly when there is nothing to say", () => {
    const copy = buildTestHomeCopy({ signalTodayCount: 0, signalLatestAt: null });
    expect(copy.gradient.signalFreshness).toEqual({ todayCount: null, latestAt: null });
  });

  it("defaults the test context to the fixture day (2 signals on 2026-07-10)", () => {
    expect(buildTestHomeCopy().gradient.signalFreshness).toEqual({
      todayCount: "今日 2 本",
      latestAt: "最新 07-10 08:30",
    });
  });
});
