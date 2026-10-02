import { describe, expect, it } from "vitest";
import { splitForHighlight } from "@/lib/search/highlight";

describe("splitForHighlight", () => {
  it("marks case-insensitive occurrences and merges overlaps", () => {
    expect(splitForHighlight("Midnight と midnight", ["midnight"])).toEqual([
      { text: "Midnight", hit: true },
      { text: " と ", hit: false },
      { text: "midnight", hit: true },
    ]);
    expect(splitForHighlight("abcd", ["abc", "bcd"])).toEqual([
      { text: "abcd", hit: true },
    ]);
  });
  it("leaves text unmarked when the term is not literally present (e.g. full-width)", () => {
    expect(splitForHighlight("ＭＩＤＮＩＧＨＴ", ["midnight"])).toEqual([
      { text: "ＭＩＤＮＩＧＨＴ", hit: false },
    ]);
  });
  it("returns the text as one plain part when no terms", () => {
    expect(splitForHighlight("abc", [])).toEqual([{ text: "abc", hit: false }]);
  });
});
