import { describe, expect, it } from "vitest";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { buildAtlasEntry } from "@/lib/home/atlas-entry";

const sample: ArticleMeta = {
  articleId: "future-map-x",
  family: "future-map",
  titleJa: "x",
  publishedAtJst: "2026-07-06T09:00:00+09:00",
  publishedLabel: "07-06 09:00 公開",
  lanes: [],
  href: "/articles/future-map-x",
};

describe("buildAtlasEntry", () => {
  it("routes to the future-map series page while unpublished", () => {
    const entry = buildAtlasEntry(false, sample);
    expect(entry.published).toBe(false);
    expect(entry.href).toBe("/articles/series/future-map");
    expect(entry.latest).toBe(sample); // passthrough
  });

  it("routes to the future-atlas surface when published", () => {
    const entry = buildAtlasEntry(true, sample);
    expect(entry.published).toBe(true);
    expect(entry.href).toBe("/future-atlas");
    expect(entry.latest).toBe(sample);
  });

  it("passes through a null latest in both states", () => {
    expect(buildAtlasEntry(false, null).latest).toBeNull();
    expect(buildAtlasEntry(true, null).latest).toBeNull();
  });
});
