import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ARTICLE_THUMBNAIL_ORIGIN,
  type ArticleInflowFeed,
} from "@/lib/articles/article-inflow-contract";
import { stripUnverifiedThumbnails } from "@/lib/articles/thumbnail-verification";

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

// 2026-10-17 (案 A1・田平氏 GO): 検証は bytes を取りに行かない。
// fetch が呼ばれたら即失敗させて「取得ゼロ」をテストの前提にする
afterEach(() => vi.unstubAllGlobals());

function forbidFetch(): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async () => {
    throw new Error("thumbnail verification must not fetch");
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("stripUnverifiedThumbnails (INFLOW-G2 D3・2026-10-17 改訂)", () => {
  it("keeps a valid mirror thumbnail without fetching its bytes", () => {
    const fetchSpy = forbidFetch();
    const result = stripUnverifiedThumbnails(feedOf([mirror("slug-a")]));
    expect(result.articles[0].thumbnail_url).toBe(GOOD_URL);
    expect(result.articles[0].thumbnail_doctrine).toBe("no_overlay");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never fetches thumbnails, however many articles the catalog holds", () => {
    const fetchSpy = forbidFetch();
    const articles = Array.from({ length: 500 }, (_, i) => {
      const sha = createHash("sha256").update(`webp-${i}`).digest("hex");
      return mirror(`slug-${i}`, {
        thumbnail_url: `${ARTICLE_THUMBNAIL_ORIGIN}/livemakers/thumbnails/slug-${i}/${sha}.webp`,
        thumbnail_checksum: sha,
      });
    });
    for (let render = 0; render < 3; render += 1) {
      const result = stripUnverifiedThumbnails(feedOf(articles));
      expect(result.articles.every((a) => a.thumbnail_url)).toBe(true);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["union missing checksum", { thumbnail_checksum: undefined }],
    ["union missing doctrine (mirror)", { thumbnail_doctrine: undefined }],
    ["origin not allowed", {
      thumbnail_url: `https://evil.example.com/livemakers/thumbnails/x/${SHA}.webp`,
    }],
    ["origin prefix spoofed by a longer host", {
      thumbnail_url: `${ARTICLE_THUMBNAIL_ORIGIN}.evil.example.com/livemakers/thumbnails/x/${SHA}.webp`,
    }],
    ["hash-named path disagreeing with the declared checksum", {
      thumbnail_url: `${ARTICLE_THUMBNAIL_ORIGIN}/livemakers/thumbnails/slug-a/${"b".repeat(64)}.webp`,
    }],
  ])("strips only the thumbnail on %s", (_label, overrides) => {
    const result = stripUnverifiedThumbnails(
      feedOf([mirror("slug-a", overrides), mirror("slug-b")]),
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

  it("logs the reject reason instead of skipping silently", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stripUnverifiedThumbnails(feedOf([mirror("slug-a", {
      thumbnail_url: `${ARTICLE_THUMBNAIL_ORIGIN}/livemakers/thumbnails/slug-a/${"b".repeat(64)}.webp`,
    })]));
    expect(warn).toHaveBeenCalledWith(
      "[article-inflow] thumbnail rejected (checksum_mismatch); serving placeholder for slug=slug-a",
    );
    warn.mockRestore();
  });

  it("accepts site-first thumbnails on the fixed-name path without doctrine (T4-2 契約の維持)", () => {
    const fetchSpy = forbidFetch();
    const siteFirst = mirror("slug-sf", {
      provenance: {
        approval_model: "policy",
        lane: "P2-LVM-SITEFIRST-G1",
        doctrine: "livemakers-sitefirst-policy-publish",
      },
      thumbnail_url: `${ARTICLE_THUMBNAIL_ORIGIN}/livemakers/articles/slug-sf/thumbnail.webp`,
      thumbnail_doctrine: undefined,
    });
    delete (siteFirst as Record<string, unknown>).source_x_url;
    const result = stripUnverifiedThumbnails(feedOf([siteFirst]));
    expect(result.articles[0].thumbnail_url).toBe(
      `${ARTICLE_THUMBNAIL_ORIGIN}/livemakers/articles/slug-sf/thumbnail.webp`,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("leaves articles without any thumbnail fields untouched", () => {
    const bare = mirror("slug-bare", {
      thumbnail_url: undefined,
      thumbnail_checksum: undefined,
      thumbnail_doctrine: undefined,
    });
    const result = stripUnverifiedThumbnails(feedOf([bare]));
    expect(result.articles[0].slug).toBe("slug-bare");
    expect(result.articles[0]).toBe(bare);
  });
});
