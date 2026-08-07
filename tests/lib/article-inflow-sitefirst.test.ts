import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  ARTICLE_INFLOW_SCHEMA_VERSION,
  buildArticleInflowPublicCatalog,
  parseArticleInflowFeed,
} from "@/lib/articles/article-inflow-contract";
import { effectiveSurfacePublished } from "@/lib/future-atlas/load";

const BODY = "# Site-first body\n\nExact bytes.\n";
const CHECKSUM = createHash("sha256").update(BODY, "utf8").digest("hex");

const POLICY_PROVENANCE = {
  approval_model: "policy",
  lane: "P2-LVM-SITEFIRST-G1",
  doctrine: "livemakers-sitefirst-policy-publish",
};

function mirrorArticle() {
  return {
    slug: "signal-20260807-mirror01",
    title: "Mirror article",
    family: "signal",
    source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
    published_at: "2026-08-07T00:00:00+00:00",
    body: BODY,
    body_checksum: CHECKSUM,
    validator: { verdict: "green", vocabulary_version: "v1" },
  };
}

function siteFirstArticle(overrides: Record<string, unknown> = {}) {
  return {
    slug: "signal-20260807-sf01",
    title: "Site-first article",
    family: "signal",
    provenance: { ...POLICY_PROVENANCE },
    published_at: "2026-08-07T01:00:00+00:00",
    body: BODY,
    body_checksum: CHECKSUM,
    validator: { verdict: "green", vocabulary_version: "v1" },
    ...overrides,
  };
}

function feedWith(articles: unknown[]) {
  return {
    schema_version: ARTICLE_INFLOW_SCHEMA_VERSION,
    environment: "staging",
    generated_at: "2026-08-07T02:00:00+09:00",
    feed_checksum: "8f36d3924040c7aa",
    articles,
  };
}

describe("site-first provenance (T4-1 mirror of sub-repo contract)", () => {
  it("accepts a mixed feed of mirror and site-first articles", () => {
    const parsed = parseArticleInflowFeed(
      feedWith([mirrorArticle(), siteFirstArticle()]),
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.articles).toHaveLength(2);
  });

  it("accepts go_record provenance and future-atlas family", () => {
    const parsed = parseArticleInflowFeed(feedWith([
      siteFirstArticle({
        slug: "future-atlas-20260807-aa11bb22",
        family: "future-atlas",
        provenance: {
          approval_model: "go_record",
          go_record_id: "batch-atlas-01+20260807T093000+0900",
        },
      }),
    ]));
    expect(parsed?.articles[0].family).toBe("future-atlas");
  });

  it("accepts site-first optional fields (thumbnail / excerpt / lanes)", () => {
    const parsed = parseArticleInflowFeed(feedWith([
      siteFirstArticle({
        thumbnail_url: "https://blob.vercel-storage.example/articles/t.webp",
        thumbnail_checksum: "a".repeat(64),
        excerpt: "抜粋テキスト",
        lanes: ["crypto", "macro"],
      }),
    ]));
    expect(parsed?.articles[0].lanes).toEqual(["crypto", "macro"]);
  });

  it.each([
    ["both source_x_url and provenance", () =>
      siteFirstArticle({ source_x_url: mirrorArticle().source_x_url })],
    ["neither source_x_url nor provenance", () => {
      const article: Record<string, unknown> = mirrorArticle();
      delete article.source_x_url;
      return article;
    }],
    ["wrong provenance lane", () =>
      siteFirstArticle({
        provenance: { ...POLICY_PROVENANCE, lane: "P2-LMK-SITEFIRST-G1" },
      })],
    ["provenance with extra keys", () =>
      siteFirstArticle({
        provenance: { ...POLICY_PROVENANCE, extra: "x" },
      })],
    ["empty go_record_id", () =>
      siteFirstArticle({
        provenance: { approval_model: "go_record", go_record_id: " " },
      })],
    ["duplicate lanes", () => siteFirstArticle({ lanes: ["crypto", "crypto"] })],
    ["bad thumbnail checksum", () =>
      siteFirstArticle({ thumbnail_checksum: "zz" })],
    ["mirror carrying site-first fields", () => ({
      ...mirrorArticle(),
      thumbnail_url: "https://blob.example/t.webp",
    })],
  ])("rejects %s", (_label, build) => {
    expect(parseArticleInflowFeed(feedWith([build()]))).toBeNull();
  });

  it("maps site-first lanes / excerpt / thumbnail into the catalog (TQ3)", () => {
    const feed = parseArticleInflowFeed(feedWith([
      siteFirstArticle({
        thumbnail_url: "https://blob.vercel-storage.example/articles/t.webp",
        thumbnail_checksum: "a".repeat(64),
        excerpt: "抜粋テキスト",
        lanes: ["crypto"],
      }),
      mirrorArticle(),
    ]));
    const catalog = buildArticleInflowPublicCatalog([], feed);
    const bySlug = new Map(
      catalog.articles.map((article) => [article.articleId, article]),
    );
    const siteFirst = bySlug.get("signal-20260807-sf01")!;
    expect(siteFirst.lanes).toEqual(["crypto"]);
    expect(siteFirst.excerptJa).toBe("抜粋テキスト");
    expect(siteFirst.thumbnailUrl).toBe(
      "https://blob.vercel-storage.example/articles/t.webp",
    );
    expect(siteFirst.sourceXUrl).toBeUndefined();
    const mirror = bySlug.get("signal-20260807-mirror01")!;
    expect(mirror.lanes).toEqual([]);
    expect(mirror.excerptJa).toBeUndefined();
    expect(mirror.thumbnailUrl).toBeUndefined();
    expect(mirror.sourceXUrl).toBe(mirrorArticle().source_x_url);
  });
});

describe("future-atlas feed-derived surface opening (P0-7)", () => {
  it("stays closed while config is false and feed has no future-atlas", () => {
    expect(effectiveSurfacePublished({ surfacePublished: false }, [
      { family: "signal" },
    ])).toBe(false);
    expect(effectiveSurfacePublished({ surfacePublished: false }, null)).toBe(
      false,
    );
  });

  it("opens when a future-atlas article is present in the feed", () => {
    expect(effectiveSurfacePublished({ surfacePublished: false }, [
      { family: "future-atlas" },
    ])).toBe(true);
  });

  it("config true wins regardless of feed", () => {
    expect(effectiveSurfacePublished({ surfacePublished: true }, null)).toBe(
      true,
    );
  });
});
