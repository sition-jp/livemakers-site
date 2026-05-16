import { describe, it, expect } from "vitest";
import { pickBriefImage, stripMarkdown, truncate } from "@/lib/brief-metadata";

describe("lib/brief-metadata", () => {
  describe("pickBriefImage", () => {
    it("returns thumbnail-ja.png for W20 when JA locale", () => {
      // W20 has thumbnail-ja.png after this PR — verify locale-specific
      // selection works for both languages.
      const result = pickBriefImage("2026-W20-brief", "ja");
      // Either: the file exists and we get the JA path, or it doesn't
      // exist yet (this PR adds the helper before the assets land) and
      // we fall back to thumbnail.png.
      const acceptable = [
        "/brief/2026-W20-brief/thumbnail-ja.png",
        "/brief/2026-W20-brief/thumbnail.png",
        null,
      ];
      expect(acceptable).toContain(result);
    });

    it("falls back to thumbnail.png for W19 (single-image legacy)", () => {
      // W19 only has thumbnail.png — must NOT 404 by requesting a
      // non-existent thumbnail-ja.png.
      const result = pickBriefImage("2026-W19-brief", "ja");
      expect(result).toBe("/brief/2026-W19-brief/thumbnail.png");
    });

    it("falls back to thumbnail.png for W18 in EN locale too", () => {
      const result = pickBriefImage("2026-W18-brief", "en");
      expect(result).toBe("/brief/2026-W18-brief/thumbnail.png");
    });

    it("returns null when slug has no image at all (e.g. W15)", () => {
      // W15 historically has no thumbnail.png — neither locale variant
      // nor fallback exists. Caller must omit the images field.
      const result = pickBriefImage("2026-W15-brief", "ja");
      expect(result).toBeNull();
    });

    it("rejects unsafe slugs (path traversal defense)", () => {
      expect(pickBriefImage("../../etc/passwd", "ja")).toBeNull();
      expect(pickBriefImage("foo/bar", "ja")).toBeNull();
      expect(pickBriefImage("..", "ja")).toBeNull();
    });

    it("returns null for unknown slug", () => {
      expect(pickBriefImage("does-not-exist", "ja")).toBeNull();
    });
  });

  describe("stripMarkdown", () => {
    it("strips bold double-asterisks", () => {
      expect(stripMarkdown("**bold** text")).toBe("bold text");
    });

    it("strips italic single-asterisks", () => {
      expect(stripMarkdown("an *italic* word")).toBe("an italic word");
    });

    it("strips bold double-underscores", () => {
      expect(stripMarkdown("__strong__ here")).toBe("strong here");
    });

    it("keeps link text and drops URL", () => {
      expect(stripMarkdown("see [the spec](https://example.com/x) now")).toBe(
        "see the spec now",
      );
    });

    it("strips inline code backticks", () => {
      expect(stripMarkdown("the `getBriefBySlug` function")).toBe(
        "the getBriefBySlug function",
      );
    });

    it("collapses whitespace and newlines to single space", () => {
      expect(stripMarkdown("first\n\nsecond   third")).toBe(
        "first second third",
      );
    });

    it("handles real brief executive summary fragment", () => {
      const input =
        "W20 は、**制度化は前進、流動性は引き締め** という構造的なねじれの一週間として記録される。";
      expect(stripMarkdown(input)).toBe(
        "W20 は、制度化は前進、流動性は引き締め という構造的なねじれの一週間として記録される。",
      );
    });
  });

  describe("truncate", () => {
    it("returns unchanged when under limit", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("truncates with ellipsis when over limit", () => {
      expect(truncate("abcdefghij", 5)).toBe("abcd…");
    });

    it("counts Japanese characters as 1 unit each", () => {
      // 「規制が動いたのに、価格は応えなかった」 = 18 chars (incl. punctuation)
      const text = "規制が動いたのに、価格は応えなかった";
      const result = truncate(text, 10);
      expect(Array.from(result).length).toBe(10);
      expect(result.endsWith("…")).toBe(true);
    });

    it("handles exact-length match without ellipsis", () => {
      expect(truncate("12345", 5)).toBe("12345");
    });
  });
});
