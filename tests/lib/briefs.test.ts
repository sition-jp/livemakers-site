import { describe, it, expect } from "vitest";
import { getAllBriefs, getBriefBySlug, getLatestBrief } from "@/lib/briefs";

describe("lib/briefs", () => {
  it("getAllBriefs filters out test-* fixtures", () => {
    const briefs = getAllBriefs();
    expect(briefs.find((b) => b.slug === "test-brief")).toBeUndefined();
  });

  it("getAllBriefs sorts by published_at descending", () => {
    const briefs = getAllBriefs();
    for (let i = 1; i < briefs.length; i++) {
      expect(briefs[i - 1].published_at >= briefs[i].published_at).toBe(true);
    }
  });

  it("getBriefBySlug returns full brief with both bodies (bypasses filter)", () => {
    const brief = getBriefBySlug("test-brief");
    expect(brief).not.toBeNull();
    expect(brief?.metadata.title_en).toBe("Test Brief Title");
    expect(brief?.metadata.issue_number).toBe(99);
    expect(brief?.metadata.tags).toContain("governance");
    expect(brief?.bodyEn).toContain("Test body content");
    expect(brief?.bodyJa).toContain("テスト用の本文");
    expect(brief?.pdfPath).toBe("/brief/test-brief/brief.pdf");
  });

  it("getBriefBySlug returns null for unknown slug", () => {
    expect(getBriefBySlug("does-not-exist")).toBeNull();
  });

  it("getLatestBrief returns null when only test fixtures exist", () => {
    // With only test-brief in the fixture directory, getAllBriefs() is empty
    // after filtering, so getLatestBrief() should return null.
    const latest = getLatestBrief();
    const all = getAllBriefs();
    if (all.length === 0) {
      expect(latest).toBeNull();
    } else {
      expect(latest?.slug).toBe(all[0].slug);
    }
  });
});
