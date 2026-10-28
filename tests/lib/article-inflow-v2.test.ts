import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY,
  articleRecordTag,
  familyFromSlug,
  fetchArticleFamilyIndex,
  fetchArticleRail,
  fetchArticleRecord,
  fetchArticleTopicIndex,
  isArticleInflowV2Enabled,
} from "@/lib/articles/article-inflow-v2";
import { ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY } from "@/lib/articles/article-inflow-feed";
import { ARTICLE_BLOB_ORIGIN } from "@/lib/articles/article-inflow-validation.mjs";

const BASE = `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/v2`;
const SLUG = "signal-20261026-0d346bb0";
const CHECKSUM = createHash("sha256").update("# body\n", "utf8").digest("hex");

const originalBase = process.env[ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY];
const originalFlag = process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];

afterEach(() => {
  if (originalBase === undefined) delete process.env[ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY];
  else process.env[ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY] = originalBase;
  if (originalFlag === undefined) delete process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];
  else process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = originalFlag;
  vi.restoreAllMocks();
});

function enable(base = BASE) {
  process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
  process.env[ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY] = base;
}

function catalogArticle(slug = SLUG, family = "signal", publishedAt = "2026-10-26T19:52:10+09:00") {
  return {
    slug,
    title: "題名",
    family,
    published_at: publishedAt,
    body_checksum: CHECKSUM,
    body_url: `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/bodies/${slug}.${CHECKSUM.slice(0, 16)}.json`,
    source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
    validator: { verdict: "green", vocabulary_version: "v1" },
  };
}

function record(article = catalogArticle()) {
  return { schema_version: "livemakers_article_record_v1", environment: "production", article };
}

function json(payload: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as unknown as Response;
}

function fetcherReturning(...responses: Response[]) {
  const queue = [...responses];
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => queue.shift() ?? json({}, 500));
}

describe("familyFromSlug", () => {
  it("drops the trailing -YYYYMMDD-<8 hex>", () => {
    expect(familyFromSlug("mkt12-morning-20261027-d32755c0")).toBe("mkt12-morning");
    expect(familyFromSlug("deep-dive-20261026-624a35f0")).toBe("deep-dive");
    expect(familyFromSlug("about")).toBeNull();
  });
});

describe("isArticleInflowV2Enabled", () => {
  it("needs the public flag and a Blob (or localhost) base URL", () => {
    enable();
    expect(isArticleInflowV2Enabled()).toBe(true);
    enable("https://example.test/v2");
    expect(isArticleInflowV2Enabled()).toBe(false);
    enable("http://127.0.0.1:8787/livemakers/article_inflow/v2");
    expect(isArticleInflowV2Enabled()).toBe(true);
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    expect(isArticleInflowV2Enabled()).toBe(false);
  });
});

describe("fetchArticleRecord", () => {
  it("finds the article and keeps it in the data cache until its tag is revalidated", async () => {
    enable();
    const fetcher = fetcherReturning(json(record()));
    const result = await fetchArticleRecord(SLUG, fetcher as typeof fetch);
    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.article.articleId).toBe(SLUG);
    expect(result.article.href).toBe(`/articles/${SLUG}`);
    expect(result.article.bodyUrl).toContain(`/bodies/${SLUG}.`);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/records/${SLUG}.json`);
    expect(init?.cache).toBe("force-cache");
    expect((init as { next?: { tags?: string[] } }).next?.tags).toEqual([articleRecordTag(SLUG)]);
    expect(articleRecordTag(SLUG)).toBe(`lvm-article-record:${SLUG}`);
  });

  it("treats 404 as missing without retrying", async () => {
    enable();
    const fetcher = fetcherReturning(json({}, 404));
    expect(await fetchArticleRecord(SLUG, fetcher as typeof fetch)).toEqual({ kind: "missing" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("treats a withdrawn record as missing", async () => {
    enable();
    const fetcher = fetcherReturning(json({
      schema_version: "livemakers_article_record_v1", environment: "production", slug: SLUG, withdrawn: true,
    }));
    expect(await fetchArticleRecord(SLUG, fetcher as typeof fetch)).toEqual({ kind: "missing" });
  });

  it("treats 403 as unavailable after two attempts", async () => {
    enable();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = fetcherReturning(json({}, 403), json({}, 403));
    expect(await fetchArticleRecord(SLUG, fetcher as typeof fetch)).toEqual({ kind: "unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects a record for another slug or a broken record", async () => {
    enable();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const other = fetcherReturning(json(record(catalogArticle("signal-20261026-aaaaaaaa"))));
    expect(await fetchArticleRecord(SLUG, other as typeof fetch)).toEqual({ kind: "unavailable" });
    const broken = fetcherReturning(json({ schema_version: "livemakers_article_record_v1" }));
    expect(await fetchArticleRecord(SLUG, broken as typeof fetch)).toEqual({ kind: "unavailable" });
  });

  it("does not fetch a slug that could escape the records directory", async () => {
    enable();
    const fetcher = fetcherReturning();
    expect(await fetchArticleRecord("../rail", fetcher as typeof fetch)).toEqual({ kind: "missing" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("fetchArticleRail / fetchArticleFamilyIndex", () => {
  it("maps the rail and revalidates it hourly", async () => {
    enable();
    const article = catalogArticle();
    const fetcher = fetcherReturning(json({
      schema_version: "livemakers_article_rail_v1",
      environment: "production",
      generated_at: "2026-10-27T07:00:00+09:00",
      latest: [article],
      by_family: { signal: [article] },
    }));
    const rail = await fetchArticleRail(fetcher as typeof fetch);
    expect(rail?.latest.map((a) => a.articleId)).toEqual([SLUG]);
    expect(rail?.byFamily.signal?.[0]?.href).toBe(`/articles/${SLUG}`);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/rail.json`);
    expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBe(3600);
  });

  it("returns null instead of throwing when the rail is unavailable", async () => {
    enable();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = fetcherReturning(json({}, 403), json({}, 403));
    await expect(fetchArticleRail(fetcher as typeof fetch)).resolves.toBeNull();
  });

  it("reads a family index", async () => {
    enable();
    const fetcher = fetcherReturning(json({
      schema_version: "livemakers_article_family_index_v1",
      environment: "production",
      family: "signal",
      items: [{ slug: SLUG, title: "題名", published_at: "2026-10-26T19:52:10+09:00" }],
    }));
    const index = await fetchArticleFamilyIndex("signal", fetcher as typeof fetch);
    expect(index).toEqual({
      family: "signal",
      items: [{ slug: SLUG, title: "題名", publishedAt: "2026-10-26T19:52:10+09:00" }],
    });
    expect(String(fetcher.mock.calls[0][0])).toBe(`${BASE}/families/signal.json`);
  });
});

describe("fetchArticleTopicIndex", () => {
  function topicIndex(overrides: Record<string, unknown> = {}) {
    return {
      schema_version: "livemakers_article_topic_index_v1",
      environment: "production",
      topic: "funding",
      generated_at: "2026-10-28T07:00:00+09:00",
      items: [
        catalogArticle("signal-20261028-aaaaaaaa", "signal", "2026-10-28T06:00:00+09:00"),
        catalogArticle("signal-20261027-bbbbbbbb", "signal", "2026-10-27T06:00:00+09:00"),
      ],
      ...overrides,
    };
  }

  it("maps items with toArticle in order", async () => {
    enable();
    const fetcher = fetcherReturning(json(topicIndex()));
    const index = await fetchArticleTopicIndex("funding", fetcher as typeof fetch);
    expect(index?.topic).toBe("funding");
    expect(index?.generatedAt).toBe("2026-10-28T07:00:00+09:00");
    expect(index?.articles.map((a) => a.articleId)).toEqual([
      "signal-20261028-aaaaaaaa",
      "signal-20261027-bbbbbbbb",
    ]);
    expect(index?.articles[0]?.href).toBe("/articles/signal-20261028-aaaaaaaa");
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/topics/funding.json`);
    expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBe(3600);
  });

  it("null on 403, 404, wrong schema, staging, topic mismatch", async () => {
    enable();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cases = [
      fetcherReturning(json({}, 403), json({}, 403)),
      fetcherReturning(json({}, 404)),
      fetcherReturning(json(topicIndex({ schema_version: "other" }))),
      fetcherReturning(json(topicIndex({ environment: "staging" }))),
      fetcherReturning(json(topicIndex({ topic: "other" }))),
    ];
    for (const fetcher of cases) {
      await expect(fetchArticleTopicIndex("funding", fetcher as typeof fetch)).resolves.toBeNull();
    }
  });

  // 公開の切り替え (LIVEMAKERS_ARTICLE_INFLOW_PUBLIC_ENABLED) を切ったら棚も出さない —
  // 隠した記事 (404) へのリンクを棚・トップ・sitemap に残さない
  it("null without fetching when the public flag is off", async () => {
    enable();
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    const fetcher = fetcherReturning(json(topicIndex()));
    await expect(fetchArticleTopicIndex("funding", fetcher as typeof fetch)).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  // 契約は通るが記事の形にできない項目 (ArticleMetaSchema が弾く) でも、
  // 呼び側 (記事ページ・一覧・トップ・sitemap) を 500 にしない
  it("null (not a throw) when an item cannot be mapped to an article", async () => {
    enable();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bad = { ...catalogArticle("signal-20261028-cccccccc"), radar_topic_id: "" };
    const fetcher = fetcherReturning(json(topicIndex({ items: [bad] })));
    await expect(fetchArticleTopicIndex("funding", fetcher as typeof fetch)).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
