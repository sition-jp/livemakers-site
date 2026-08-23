import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ARTICLE_INFLOW_FEED_ENV_KEY,
  ARTICLE_INFLOW_FEED_FETCH_ATTEMPTS,
  ARTICLE_INFLOW_FEED_MEMO_TTL_MS,
  resetArticleInflowFeedMemo,
  ARTICLE_INFLOW_FEED_FETCH_TIMEOUT_MS,
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
      slug: "daily-intel-20260101-feedtest",
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
  resetArticleInflowFeedMemo();
  vi.useRealTimers();
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
        next: { revalidate: 3600 },
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
      "daily-intel-20260101-feedtest",
      "ja",
    );

    expect(detail).toMatchObject({
      body: "# Exact body\n",
      declaredBodyChecksum: production.articles[0].body_checksum,
      renderedBodyChecksum: production.articles[0].body_checksum,
      article: { source: "inflow", href: "/articles/daily-intel-20260101-feedtest" },
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

// 2026-08-23 (田平氏 GO): #107 deploy 直後 14:47–14:53 に記事 feed の取り込みだけが
// 失敗し (/ja ISR 固定 + /en の新規 prerender も失敗)、カタログが repository_only
// = 「先祖返り」に見えた (8/10・8/11・同日 13:3x に続く 4 回目・いずれも deploy
// 直後)。Blob の feed と site のローダは検証済みで無罪 — 残るのは feed 本体の
// fetch の一時失敗。terminal feed (#106) と同型の bounded retry + 失敗理由の
// 可視化 (Vercel runtime logs で種別が分かるように)。
describe("article inflow feed — transient failure retry (2026-08-23)", () => {
  const production = () => ({ ...payload(), environment: "production" });

  function enableProduction() {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "true";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = "https://example.test/production.json";
  }

  it("retries once after a thrown fetch error and returns the validated feed", async () => {
    enableProduction();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce({ ok: true, json: async () => production() });
    const feed = await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(feed?.environment).toBe("production");
    expect(fetcher).toHaveBeenCalledTimes(2);
    // the transient attempt is observable (reason included), but not as a
    // repository-only degrade
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("socket hang up"));
    expect(warning).not.toHaveBeenCalledWith(expect.stringContaining("repository-only"));
  });

  it("retries once after a non-ok response", async () => {
    enableProduction();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => production() });
    const feed = await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(feed?.environment).toBe("production");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("retries once when the body cannot be read as JSON", async () => {
    enableProduction();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => { throw new Error("terminated"); } })
      .mockResolvedValueOnce({ ok: true, json: async () => production() });
    const feed = await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(feed?.environment).toBe("production");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last attempt with the reason in the repository-only warning", async () => {
    enableProduction();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) });
    expect(await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(ARTICLE_INFLOW_FEED_FETCH_ATTEMPTS);
    expect(ARTICLE_INFLOW_FEED_FETCH_ATTEMPTS).toBe(2);
    const last = warning.mock.calls.at(-1)?.[0] as string;
    expect(last).toContain("repository-only");
    expect(last).toContain("502");
  });

  it("does not retry a payload the contract rejects (it will not change on retry)", async () => {
    enableProduction();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => payload() })); // staging env
    expect(await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the first attempt succeeds", async () => {
    enableProduction();
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => production() }));
    await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds every attempt with an abort signal, keeps the data-cache revalidate, and stays inside the route budget", async () => {
    enableProduction();
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => production() }));
    await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    const [, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit & { next?: { revalidate?: number } },
    ];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.next?.revalidate).toBe(3600);
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(ARTICLE_INFLOW_FEED_FETCH_TIMEOUT_MS).toBeGreaterThan(0);
    // #106 と同じ予算観: 2 attempts × timeout ≤ 9s (terminal feed と並列に走る)
    expect(ARTICLE_INFLOW_FEED_FETCH_TIMEOUT_MS * ARTICLE_INFLOW_FEED_FETCH_ATTEMPTS).toBeLessThanOrEqual(9_000);
  });
});

// 2026-08-23 (田平氏 GO 案 B): 記事 feed (1.67MB) は Next data cache の 1 件 2MB
// 上限 (base64 ×4/3) を超え一度もキャッシュされない (Vercel logs "Failed to set
// Next.js data cache … items over 2MB")。deploy / revalidate 直後に記事ページ
// 数十本が同時再描画 → 全部が Blob から 1.67MB を取り直し → 一部が落ちて
// repository_only (先祖返り)。プロセス内メモ (TTL 2 分) + single-flight で
// ウォームインスタンス内の同時ダウンロードを 1 回に潰す。失敗 (null) は
// メモしない。
describe("article inflow feed — in-process memo + single-flight (2026-08-23 案 B)", () => {
  const production = () => ({ ...payload(), environment: "production" });
  function enableProduction(url = "https://example.test/production.json") {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "true";
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = url;
  }

  it("serves the second call within the TTL from memory without fetching", async () => {
    enableProduction();
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => production() }));
    const first = await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    const second = await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(first?.environment).toBe("production");
    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("collapses concurrent calls into a single in-flight fetch", async () => {
    enableProduction();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetcher = vi.fn(async () => { await gate; return { ok: true, json: async () => production() }; });
    const calls = [1, 2, 3].map(() =>
      fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch),
    );
    release();
    const feeds = await Promise.all(calls);
    expect(feeds.every((feed) => feed?.environment === "production")).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches once the TTL has elapsed", async () => {
    vi.useFakeTimers();
    enableProduction();
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => production() }));
    await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    vi.advanceTimersByTime(ARTICLE_INFLOW_FEED_MEMO_TTL_MS + 1);
    await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(ARTICLE_INFLOW_FEED_MEMO_TTL_MS).toBe(120_000);
  });

  it("does not memoize a failed load (next call retries the network)", async () => {
    enableProduction();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValue({ ok: true, json: async () => production() });
    expect(await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch)).toBeNull();
    const feed = await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(feed?.environment).toBe("production");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("keys the memo by URL and environment (preview and production never share)", async () => {
    enableProduction();
    process.env[ARTICLE_INFLOW_PREVIEW_FLAG_ENV_KEY] = "true";
    process.env[ARTICLE_INFLOW_FEED_ENV_KEY] = "https://example.test/staging.json";
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes("production") ? production() : payload()),
    }));
    const prod = await fetchProductionArticleInflowFeed(fetcher as unknown as typeof fetch);
    const preview = await fetchArticleInflowFeed(fetcher as unknown as typeof fetch);
    expect(prod?.environment).toBe("production");
    expect(preview?.environment).toBe("staging");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
