import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ARTICLE_THUMBNAIL_ORIGIN,
  type ArticleInflowFeed,
} from "@/lib/articles/article-inflow-contract";
import {
  THUMBNAIL_VERIFICATION_CONCURRENCY,
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

  it("keys the persistent verification cache by the declared thumbnail checksum", async () => {
    const fetcher = vi.fn(fetcherReturning(BYTES));

    await stripUnverifiedThumbnails(feedOf([mirror("slug-a")]), fetcher as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith(`${GOOD_URL}?sha256=${SHA}`, {
      cache: "force-cache",
      redirect: "error",
    });
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

/**
 * 2026-09-27: 記事ページの再生成が重なると、1 描画ごとに catalog 全件
 * (~420 本) のサムネ検証 GET が同時に走り、3 描画同時で 1,257 本 → 接続
 * タイムアウト / ECONNRESET で約 1 割が失敗した (実測)。失敗した記事は
 * placeholder のまま ISR に最大 1 時間焼き付く (DD 0829 / 0903 / 0921)。
 */
describe("stripUnverifiedThumbnails — 同時描画バースト耐性", () => {
  function okResponse(bytes: Buffer = BYTES) {
    return {
      ok: true,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  }

  function thumbFor(slug: string) {
    const bytes = Buffer.from(`webp-${slug}`);
    const sha = createHash("sha256").update(bytes).digest("hex");
    return {
      bytes,
      article: mirror(slug, {
        thumbnail_url: `${ARTICLE_THUMBNAIL_ORIGIN}/livemakers/articles/${slug}/thumbnail.webp`,
        thumbnail_checksum: sha,
      }),
    };
  }

  it("retries a transient fetch failure once and keeps the thumbnail", async () => {
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed");
      return okResponse();
    }) as unknown as typeof fetch;
    const result = await stripUnverifiedThumbnails(feedOf([mirror("slug-a")]), flaky);
    expect(calls).toBe(2);
    expect(result.articles[0].thumbnail_url).toBe(GOOD_URL);
  });

  it("does not retry a checksum mismatch (bytes will not change on retry)", async () => {
    let calls = 0;
    const tampered = (async () => {
      calls += 1;
      return okResponse(Buffer.from("tampered"));
    }) as unknown as typeof fetch;
    const result = await stripUnverifiedThumbnails(feedOf([mirror("slug-a")]), tampered);
    expect(calls).toBe(1);
    expect(result.articles[0].thumbnail_url).toBeUndefined();
  });

  it("shares one in-flight verification across concurrent renders", async () => {
    let calls = 0;
    const slow = (async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return okResponse();
    }) as unknown as typeof fetch;
    const results = await Promise.all([
      stripUnverifiedThumbnails(feedOf([mirror("slug-a")]), slow),
      stripUnverifiedThumbnails(feedOf([mirror("slug-a")]), slow),
      stripUnverifiedThumbnails(feedOf([mirror("slug-a")]), slow),
    ]);
    expect(calls).toBe(1);
    for (const result of results) {
      expect(result.articles[0].thumbnail_url).toBe(GOOD_URL);
    }
  });

  it("bounds concurrent verification GETs across the whole process", async () => {
    const thumbs = Array.from({ length: 60 }, (_, i) => thumbFor(`slug-${i}`));
    const bytesByUrl = new Map(
      thumbs.map(({ article, bytes }) => [
        `${article.thumbnail_url}?sha256=${article.thumbnail_checksum}`,
        bytes,
      ]),
    );
    let active = 0;
    let peak = 0;
    const tracking = (async (url: string) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return okResponse(bytesByUrl.get(url)!);
    }) as unknown as typeof fetch;
    const half = thumbs.length / 2;
    const [first, second] = await Promise.all([
      stripUnverifiedThumbnails(feedOf(thumbs.slice(0, half).map((t) => t.article)), tracking),
      stripUnverifiedThumbnails(feedOf(thumbs.slice(half).map((t) => t.article)), tracking),
    ]);
    expect(peak).toBeLessThanOrEqual(THUMBNAIL_VERIFICATION_CONCURRENCY);
    expect([...first.articles, ...second.articles].every((a) => a.thumbnail_url)).toBe(true);
  });
});
