import { describe, expect, test } from "vitest";

import { formatJst } from "@/lib/pivots/format-jst";

describe("formatJst", () => {
  test("23:00Z → next morning 08:00 JST", () => {
    expect(formatJst("2026-09-25T23:00:17Z")).toBe("2026-09-26 08:00 JST");
  });
  test("midnight boundary", () => {
    expect(formatJst("2026-12-31T15:00:00Z")).toBe("2027-01-01 00:00 JST");
  });
  test("null / invalid → null", () => {
    expect(formatJst(null)).toBeNull();
    expect(formatJst("nope")).toBeNull();
  });
});
