import { describe, expect, it } from "vitest";

import { resolveTodayJst } from "@/lib/home/resolve-today";

describe("resolveTodayJst", () => {
  it("returns the JST calendar date", () => {
    expect(resolveTodayJst(new Date("2026-08-03T01:00:00+09:00"))).toBe(
      "2026-08-03",
    );
  });

  it("crosses the UTC date boundary correctly", () => {
    // 2026-08-03T23:30Z = 2026-08-04T08:30 JST
    expect(resolveTodayJst(new Date("2026-08-03T23:30:00Z"))).toBe(
      "2026-08-04",
    );
  });

  it("stays on the previous JST day before midnight JST", () => {
    // 2026-08-03T14:59Z = 2026-08-03T23:59 JST
    expect(resolveTodayJst(new Date("2026-08-03T14:59:00Z"))).toBe(
      "2026-08-03",
    );
  });
});
