import { describe, expect, it } from "vitest";

import {
  adjacentDays,
  formatDayLabel,
  parseDayParam,
  selectArticlesForDay,
} from "@/lib/articles/day-archive";

describe("parseDayParam", () => {
  it("accepts a real past or current date", () => {
    expect(parseDayParam("2026-11-09", "2026-11-10")).toBe("2026-11-09");
    expect(parseDayParam("2026-11-10", "2026-11-10")).toBe("2026-11-10");
  });

  it.each(["2026-11-11", "2026-02-30", "2026-1-9", "20261109", "today", ""])(
    "rejects %s",
    (v) => {
      expect(parseDayParam(v, "2026-11-10")).toBeNull();
    },
  );
});

describe("selectArticlesForDay", () => {
  it("keeps only that JST day in input order", () => {
    const a = [
      { id: "c", publishedAtJst: "2026-11-10T01:30:00+09:00" },
      { id: "b", publishedAtJst: "2026-11-09T23:59:00+09:00" },
      { id: "a", publishedAtJst: "2026-11-09T00:00:00+09:00" },
      { id: "z", publishedAtJst: "2026-11-08T23:59:00+09:00" },
    ];
    expect(selectArticlesForDay(a, "2026-11-09").map((x) => x.id)).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("adjacentDays", () => {
  it("crosses month ends and hides future next", () => {
    expect(adjacentDays("2026-11-01", "2026-11-10")).toEqual({
      prev: "2026-10-31",
      next: "2026-11-02",
    });
    expect(adjacentDays("2026-11-10", "2026-11-10")).toEqual({
      prev: "2026-11-09",
      next: null,
    });
  });
});

describe("formatDayLabel", () => {
  it("is unpadded", () => {
    expect(formatDayLabel("2026-11-09")).toEqual({ month: 11, day: 9 });
  });
});
