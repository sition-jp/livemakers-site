import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ARTICLE_INFLOW_FEED_ENV_KEY,
  ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY,
  ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY,
  ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY,
  fetchArticleInflowFeed,
  fetchProductionArticleInflowFeed,
  isArticleInflowPreviewEnabled,
  isArticleInflowPublicEnabled,
  loadPublicArticleInflowCatalog,
  loadPublicArticleInflowDetail,
} from "@/lib/articles/article-inflow-feed";
import { getAllArticles } from "@/lib/articles/article-model";

const originalUrl = process.env.LIVEMAKERS_ARTICLE_INFLOW_FEED_URL;
const originalFlag = process.env.LIVEMAKERS_ARTICLE_INFLOW_PREVIEW_ENABLED;
const originalProductionUrl = process.env.LIVEMAKERS_ARTICLE_INFLOW_PRODUCTION_FEED_URL;
const originalPublicFlag = process.env.LIVEMAKERS_ARTICLE_INFLOW_PUBLIC_ENABLED;

function payload(body = "# Exact body\n") {
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
  if (originalProductionUrl === undefined) {
    delete process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY];
  } else {
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = originalProductionUrl;
  }
  if (originalPublicFlag === undefined) delete process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];
  else process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = originalPublicFlag;
  vi.unstubAllGlobals();
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

  it.each([
    ["effectful MDX expression", "Danger: {globalThis.process.exit(1)}"],
    ["JSX", "<DangerouslySetInnerHTML html={{__html: globalThis.process.env.SECRET}} />"],
    ["ESM", "export const secret = globalThis.process.env.SECRET"],
    ["raw HTML", "<script>globalThis.process.exit(1)</script>"],
  ])("rejects the complete configured feed when one article contains %s", async (_label, body) => {
    process.env[ARTICLE_INFLOW_FEED_ENV_KEY] = "https://example.test/feed.json";
    const feed = payload();
    feed.articles.push({
      ...feed.articles[0],
      slug: "unsafe-body",
      body,
      body_checksum: createHash("sha256").update(body, "utf8").digest("hex"),
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => feed }));

    expect(await fetchArticleInflowFeed(fetcher as unknown as typeof fetch)).toBeNull();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("repository-only"));
  });

  it("preserves ordinary Markdown, fenced code, literal braces, and exact body bytes", async () => {
    process.env[ARTICLE_INFLOW_FEED_ENV_KEY] = "https://example.test/feed.json";
    const body = [
      "# Exact body",
      "",
      "A literal placeholder: {status}",
      "",
      "```tsx",
      "<Widget value={globalThis.process.env.SECRET} />",
      "```",
      "",
    ].join("\n");
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => payload(body) }));

    const feed = await fetchArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(feed?.articles[0].body).toBe(body);
    expect(feed?.articles[0].body_checksum).toBe(
      createHash("sha256").update(body, "utf8").digest("hex"),
    );
  });

  it.each([[undefined, false], ["0", false], ["false", false], ["1", true], ["true", true]])(
    "maps flag %s to %s",
    (value, expected) => {
      if (value === undefined) delete process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY];
      else process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY] = value;
      expect(isArticleInflowPreviewEnabled()).toBe(expected);
    },
  );

  it.each([[undefined, false], ["0", false], ["false", false], ["1", true], ["true", true]])(
    "maps the public flag %s to %s",
    (value, expected) => {
      if (value === undefined) delete process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];
      else process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = value;
      expect(isArticleInflowPublicEnabled()).toBe(expected);
    },
  );

  it("does not fetch Production when the public flag is disabled", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = "https://example.test/production.json";
    const fetcher = vi.fn();

    expect(await fetchProductionArticleInflowFeed(fetcher as typeof fetch)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not fetch Production when its dedicated URL is absent", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
    delete process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY];
    const fetcher = vi.fn();

    expect(await fetchProductionArticleInflowFeed(fetcher as typeof fetch)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts only a validated Production feed through the public boundary", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "true";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = "https://example.test/production.json";
    const production = { ...payload(), environment: "production" };
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => production }));

    const feed = await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);

    expect(feed?.environment).toBe("production");
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.test/production.json",
      expect.objectContaining({
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      }),
    );
  });

  it("rejects a staging feed at the public boundary", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = "https://example.test/production.json";
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => payload() }));

    expect(await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch)).toBeNull();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("repository-only"));
  });

  it("returns the complete repository-only catalog without fetching when public is disabled", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = "https://example.test/production.json";
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const catalog = await loadPublicArticleInflowCatalog();

    expect(catalog.feedChecksum).toBeNull();
    expect(catalog.articles.length).toBeGreaterThan(0);
    expect(catalog.articles.every((article) => article.source === "repository")).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns exact inflow detail checksums from a validated Production catalog", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = "https://example.test/production.json";
    const production = { ...payload(), environment: "production" };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => production })));

    const detail = await loadPublicArticleInflowDetail(
      "daily-intel-20260719-48cea1b8",
      "ja",
    );

    expect(detail).toMatchObject({
      body: "# Exact body\n",
      declaredBodyChecksum: production.articles[0].body_checksum,
      renderedBodyChecksum: production.articles[0].body_checksum,
      article: { source: "inflow", href: "/articles/daily-intel-20260719-48cea1b8" },
    });
  });

  it("keeps repository ownership when a Production feed duplicates its slug", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "true";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = "https://example.test/production.json";
    const repositoryArticle = getAllArticles()[0];
    const production = { ...payload(), environment: "production" };
    production.articles[0] = {
      ...production.articles[0],
      slug: repositoryArticle.articleId,
      title: "Feed must lose",
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => production })));

    const catalog = await loadPublicArticleInflowCatalog();

    expect(catalog.articles.filter((article) => article.articleId === repositoryArticle.articleId))
      .toEqual([expect.objectContaining({
        source: "repository",
        titleJa: repositoryArticle.titleJa,
        href: `/articles/${repositoryArticle.articleId}`,
      })]);
  });
});
