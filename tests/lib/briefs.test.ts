import { describe, it, expect } from "vitest";
import { getAllBriefs, getBriefBySlug, getLatestBrief } from "@/lib/briefs";

describe("lib/briefs", () => {
  it("getAllBriefs returns metadata for every brief", () => {
    const briefs = getAllBriefs();
    expect(briefs.length).toBeGreaterThan(0);
    const test = briefs.find((b) => b.slug === "test-brief");
    expect(test).toBeDefined();
    expect(test?.issue_number).toBe(99);
    expect(test?.tags).toContain("governance");
  });

  it("getAllBriefs sorts by published_at descending", () => {
    const briefs = getAllBriefs();
    for (let i = 1; i < briefs.length; i++) {
      expect(briefs[i - 1].published_at >= briefs[i].published_at).toBe(true);
    }
  });

  it("getBriefBySlug returns full brief with both bodies", () => {
    const brief = getBriefBySlug("test-brief");
    expect(brief).not.toBeNull();
    expect(brief?.metadata.title_en).toBe("Test Brief Title");
    expect(brief?.bodyEn).toContain("Test body content");
    expect(brief?.bodyJa).toContain("テスト用の本文");
    expect(brief?.pdfPath).toBe("/brief/test-brief/brief.pdf");
  });

  it("getBriefBySlug returns null for unknown slug", () => {
    expect(getBriefBySlug("does-not-exist")).toBeNull();
  });

  it("getLatestBrief returns the most recent brief", () => {
    const latest = getLatestBrief();
    expect(latest).not.toBeNull();
    const all = getAllBriefs();
    expect(latest?.slug).toBe(all[0].slug);
  });
});
