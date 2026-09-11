import { describe, expect, it } from "vitest";

import { formatPublishedLabelWithYear } from "@/lib/articles/published-date";

describe("lib/articles/published-date", () => {
  it("renders the year-visible JST label from the wall-clock ISO string", () => {
    expect(formatPublishedLabelWithYear("2026-09-11T05:50:00+09:00")).toBe(
      "2026-09-11 05:50 公開",
    );
  });

  it("does not depend on server timezone (string-sliced, not Date-converted)", () => {
    // seconds present or absent both parse
    expect(formatPublishedLabelWithYear("2026-01-02T23:05+09:00")).toBe(
      "2026-01-02 23:05 公開",
    );
  });
});
