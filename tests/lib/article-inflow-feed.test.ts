import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ARTICLE_INFLOW_FEED_ENV_KEY,
  ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY,
  fetchArticleInflowFeed,
  isArticleInflowPreviewEnabled,
} from "@/lib/articles/article-inflow-feed";

const originalUrl = process.env.LIVEMAKERS_ARTICLE_INFLOW_FEED_URL;
const originalFlag = process.env.LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED;

function payload() {
  const body = "# Exact body\n";
  return {
    schema_version: "livemakers_article_inflow_feed_v0",
    environment: "staging",
    generated_at: "2026-07-19T09:56:11.862371+09:00",
    feed_checksum: "8f36d3924040c7aa",
    articles: [{
      slug: "daily-intel-20260719-48cea1b8",
      title: "Daily Intel",
      family: "daily-intel",
      source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
      published_at: "2026-07-18T22:20:14.874652+00:00",
      body,
      body_checksum: createHash("sha256").update(body, "utf8").digest("hex"),
      validator: { verdict: "green", vocabulary_version: "99f41b7549a0a4f5" },
    }],
  };
}

afterEach(() => {
  if (originalUrl === undefined) delete process.env[ARTICLE_INFLOW_FEED_ENV_KEY];
  else process.env[ARTICLE_INFLOW_FEED_ENV_KEY] = originalUrl;
  if (originalFlag === undefined) delete process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY];
  else process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY] = originalFlag;
  vi.restoreAllMocks();
});

describe("article inflow server boundary", () => {
  it("does not fetch when the dedicated URL is absent", async () => {
    delete process.env[ARTICLE_INFLOW_FEED_ENV_KEY];
    const fetcher = vi.fn();
    expect(await fetchArticleInflowFeed(fetcher as typeof fetch)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["throws", "non-ok", "invalid-json", "invalid-contract"])(
    "fails closed when the request %s",
    async (mode) => {
      process.env[ARTICLE_INFLOW_FEED_ENV_KEY] = "https://example.test/feed.json";
      const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const fetcher = vi.fn(async () => {
        if (mode === "throws") throw new Error("offline");
        if (mode === "non-ok") return { ok: false };
        return {
          ok: true,
          json: async () => {
            if (mode === "invalid-json") throw new Error("bad json");
            if (mode === "invalid-contract") return { schema_version: "wrong" };
            return payload();
          },
        };
      });
      expect(await fetchArticleInflowFeed(fetcher as unknown as typeof fetch)).toBeNull();
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining("repository-only"),
      );
    },
  );

  it("returns a fully validated feed", async () => {
    process.env[ARTICLE_INFLOW_FEED_ENV_KEY] = "https://example.test/feed.json";
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => payload() }));
    const feed = await fetchArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(feed?.feed_checksum).toBe("8f36d3924040c7aa");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([[undefined, false], ["0", false], ["false", false], ["1", true], ["true", true]])(
    "maps flag %s to %s",
    (value, expected) => {
      if (value === undefined) delete process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY];
      else process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY] = value;
      expect(isArticleInflowPreviewEnabled()).toBe(expected);
    },
  );
});
