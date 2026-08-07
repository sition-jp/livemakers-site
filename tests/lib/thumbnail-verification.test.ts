import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ARTICLE_THUMBNAIL_ORIGIN,
  type ArticleInflowFeed,
} from "@/lib/articles/article-inflow-contract";
import {
  clearThumbnailVerificationCache,
  stripUnverifiedThumbnails,
} from "@/lib/articles/thumbnail-verification";

const BYTES = Buffer.from("webp-bytes");
const SHA = createHash("sha256").update(BYTES).digest("hex");
const GOOD_URL = `${ARTICLE_THUMBNAIL_ORIGIN}/livemakers/thumbnails/slug-a/${SHA}.webp`;

function mirror(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    title: `記事 ${slug}`,
    family: "signal",
    source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
    published_at: "2026-08-07T00:00:00+00:00",
    body: "本文",
    body_checksum: "a".repeat(64),
    validator: { verdict: "green", vocabulary_version: "v1" },
    thumbnail_url: GOOD_URL,
    thumbnail_checksum: SHA,
    thumbnail_doctrine: "no_overlay",
    ...overrides,
  };
}

function feedOf(articles: unknown[]): ArticleInflowFeed {
  return {
    schema_version: "livemakers_article_inflow_feed_v0",
    environment: "staging",
    generated_at: "2026-08-07T02:00:00+09:00",
    feed_checksum: "8f36d3924040c7aa",
    articles,
  } as ArticleInflowFeed;
}

function fetcherReturning(bytes: Buffer, ok = true): typeof fetch {
  return (async () => ({
    ok,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  })) as unknown as typeof fetch;
}

beforeEach(() => clearThumbnailVerificationCache());

describe("stripUnverifiedThumbnails (INFLOW-G2 D3)", () => {
  it("keeps a fully verified mirror thumbnail", async () => {
    const result = await stripUnverifiedThumbnails(
      feedOf([mirror("slug-a")]),
      fetcherReturning(BYTES),
    );
    expect(result.articles[0].thumbnail_url).toBe(GOOD_URL);
    expect(result.articles[0].thumbnail_doctrine).toBe("no_overlay");
  });

  it.each([
    ["union missing checksum", { thumbnail_checksum: undefined }],
    ["union missing doctrine (mirror)", { thumbnail_doctrine: undefined }],
    ["origin not allowed", {
      thumbnail_url: `https://evil.example.com/livemakers/thumbnails/x/${SHA}.webp`,
    }],
  ])("strips only the thumbnail on %s", async (_label, overrides) => {
    const result = await stripUnverifiedThumbnails(
      feedOf([mirror("slug-a", overrides), mirror("slug-b")]),
      fetcherReturning(BYTES),
    );
    const [bad, good] = result.articles;
    expect(bad.thumbnail_url).toBeUndefined();
    expect(bad.thumbnail_checksum).toBeUndefined();
    expect(bad.thumbnail_doctrine).toBeUndefined();
    expect(bad.slug).toBe("slug-a");
    expect(bad.body).toBe("本文");
    expect(good.thumbnail_url).toBe(GOOD_URL);
    expect(result.articles).toHaveLength(2);
  });

  it("strips on checksum mismatch between declared and fetched bytes", async () => {
    const result = await stripUnverifiedThumbnails(
      feedOf([mirror("slug-a")]),
      fetcherReturning(Buffer.from("tampered")),
    );
    expect(result.articles[0].thumbnail_url).toBeUndefined();
  });

  it("strips on fetch failure (redirect / network / non-2xx)", async () => {
    const failing = (async () => {
      throw new TypeError("redirect");
    }) as unknown as typeof fetch;
    const result = await stripUnverifiedThumbnails(feedOf([mirror("slug-a")]), failing);
    expect(result.articles[0].thumbnail_url).toBeUndefined();
  });

  it("accepts site-first thumbnails without doctrine (T4-2 契約の維持)", async () => {
    const siteFirst = mirror("slug-sf", {
      source_x_url: undefined,
      provenance: {
        approval_model: "policy",
        lane: "P2-LVM-SITEFIRST-G1",
        doctrine: "livemakers-sitefirst-policy-publish",
      },
      thumbnail_doctrine: undefined,
    });
    delete (siteFirst as Record<string, unknown>).source_x_url;
    const result = await stripUnverifiedThumbnails(
      feedOf([siteFirst]),
      fetcherReturning(BYTES),
    );
    expect(result.articles[0].thumbnail_url).toBe(GOOD_URL);
  });

  it("leaves articles without any thumbnail fields untouched (no fetch)", async () => {
    const bare = mirror("slug-bare", {
      thumbnail_url: undefined,
      thumbnail_checksum: undefined,
      thumbnail_doctrine: undefined,
    });
    let called = 0;
    const counting = (async () => {
      called += 1;
      throw new Error("must not fetch");
    }) as unknown as typeof fetch;
    const result = await stripUnverifiedThumbnails(feedOf([bare]), counting);
    expect(called).toBe(0);
    expect(result.articles[0].slug).toBe("slug-bare");
  });

  it("memoizes verified urls (single fetch across calls)", async () => {
    let calls = 0;
    const counting = (async () => {
      calls += 1;
      return {
        ok: true,
        arrayBuffer: async () => BYTES.buffer.slice(BYTES.byteOffset, BYTES.byteOffset + BYTES.byteLength),
      };
    }) as unknown as typeof fetch;
    await stripUnverifiedThumbnails(feedOf([mirror("slug-a")]), counting);
    await stripUnverifiedThumbnails(feedOf([mirror("slug-a")]), counting);
    expect(calls).toBe(1);
  });
});
