import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY,
  ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY,
  ArticleInflowUnavailableError,
  loadPublicArticleInflowDetail,
  resetArticleInflowFeedMemo,
} from "@/lib/articles/article-inflow-feed";
import { ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY } from "@/lib/articles/article-inflow-v2";
import { loadArticleDetailContext } from "@/lib/articles/article-detail-context";
import { getAllArticles, type ArticleMeta } from "@/lib/articles/article-model";
import { getSeriesNeighbors } from "@/lib/articles/related";
import {
  ARTICLE_BLOB_ORIGIN,
  ARTICLE_INFLOW_BODY_SCHEMA_VERSION,
} from "@/lib/articles/article-inflow-validation.mjs";

const BASE = `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/v2`;
const CATALOG_URL = `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow.production.catalog.v1.json`;
const BODY = "# 本文\n\nそのまま。\n";
const CHECKSUM = createHash("sha256").update(BODY, "utf8").digest("hex");
const SLUG = "signal-20261026-0d346bb0";
const BODY_URL = `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/bodies/${SLUG}.${CHECKSUM.slice(0, 16)}.json`;

const saved = Object.fromEntries(
  [ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY, ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY,
    ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY, "NEXT_PHASE"].map((key) => [key, process.env[key]]),
);

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetArticleInflowFeedMemo();
});

function enableV2() {
  process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
  process.env[ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY] = BASE;
  process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
  delete process.env.NEXT_PHASE;
}

function item(slug: string, family = "signal", publishedAt = "2026-10-26T19:52:10+09:00", extra = {}) {
  const checksum = slug === SLUG ? CHECKSUM : "d".repeat(64);
  return {
    slug,
    title: `題名 ${slug}`,
    family,
    published_at: publishedAt,
    body_checksum: checksum,
    body_url: `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/bodies/${slug}.${checksum.slice(0, 16)}.json`,
    source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
    validator: { verdict: "green", vocabulary_version: "v1" },
    ...extra,
  };
}

const json = (payload: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => payload }) as unknown as Response;

function routed(routes: Record<string, () => Response>) {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const route = routes[url];
    return route ? route() : json({}, 404);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

const recordRoute = () =>
  json({ schema_version: "livemakers_article_record_v1", environment: "production", article: item(SLUG) });
const bodyRoute = () =>
  json({ schema_version: ARTICLE_INFLOW_BODY_SCHEMA_VERSION, slug: SLUG, body_checksum: CHECKSUM, body: BODY });

describe("loadPublicArticleInflowDetail (v2)", () => {
  it("renders from the record and the body without reading the v1 catalog", async () => {
    enableV2();
    const fetcher = routed({ [`${BASE}/records/${SLUG}.json`]: recordRoute, [BODY_URL]: bodyRoute });
    const detail = await loadPublicArticleInflowDetail(SLUG, "ja");
    expect(detail?.article.articleId).toBe(SLUG);
    expect(detail?.body).toBe(BODY);
    expect(fetcher.mock.calls.map((call) => String(call[0]))).not.toContain(CATALOG_URL);
  });

  it("returns null (→ notFound) when the record is 404", async () => {
    enableV2();
    routed({});
    await expect(loadPublicArticleInflowDetail(SLUG, "ja")).resolves.toBeNull();
  });

  it("throws (→ keep the previous page) when the record is 403", async () => {
    enableV2();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    routed({ [`${BASE}/records/${SLUG}.json`]: () => json({}, 403) });
    await expect(loadPublicArticleInflowDetail(SLUG, "ja")).rejects.toBeInstanceOf(
      ArticleInflowUnavailableError,
    );
  });

  it("degrades to null during next build when the record is 403", async () => {
    enableV2();
    process.env.NEXT_PHASE = "phase-production-build";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    routed({ [`${BASE}/records/${SLUG}.json`]: () => json({}, 403) });
    await expect(loadPublicArticleInflowDetail(SLUG, "ja")).resolves.toBeNull();
  });

  it("serves a repository article without fetching anything", async () => {
    enableV2();
    const repository = getAllArticles()[0];
    const fetcher = routed({});
    const detail = await loadPublicArticleInflowDetail(repository.articleId, "ja");
    expect(detail?.article.source).toBe("repository");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps reading the v1 catalog when v2 is not configured", async () => {
    enableV2();
    delete process.env[ARTICLE_INFLOW_V2_BASE_URL_ENV_KEY];
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = routed({});
    await loadPublicArticleInflowDetail(SLUG, "ja").catch(() => null);
    expect(fetcher.mock.calls.map((call) => String(call[0]))).toContain(CATALOG_URL);
  });
});

function current(): ArticleMeta {
  return {
    articleId: SLUG,
    family: "signal",
    titleJa: "今の記事",
    publishedAtJst: "2026-10-26T19:52:10+09:00",
    publishedLabel: "10-26 19:52 公開",
    lanes: [],
    href: `/articles/${SLUG}`,
  };
}

const railRoute = () =>
  json({
    schema_version: "livemakers_article_rail_v1",
    environment: "production",
    generated_at: "2026-10-27T07:00:00+09:00",
    latest: [item("flash-20261027-aaaaaaaa", "flash", "2026-10-27T06:00:00+09:00"), item(SLUG)],
    by_family: {
      signal: [item("signal-20261027-bbbbbbbb", "signal", "2026-10-27T05:00:00+09:00"), item(SLUG)],
      flash: [item("flash-20261027-aaaaaaaa", "flash", "2026-10-27T06:00:00+09:00")],
    },
  });

const familyRoute = () =>
  json({
    schema_version: "livemakers_article_family_index_v1",
    environment: "production",
    family: "signal",
    items: [
      { slug: "signal-20261027-bbbbbbbb", title: "次の記事", published_at: "2026-10-27T05:00:00+09:00" },
      { slug: "signal-20261026-ffffffff", title: "同時刻・slug が大きい", published_at: "2026-10-26T19:52:10+09:00" },
      { slug: SLUG, title: "今の記事", published_at: "2026-10-26T19:52:10+09:00" },
      { slug: "signal-20261025-cccccccc", title: "前の記事", published_at: "2026-10-25T07:00:00+09:00" },
    ],
  });

const topicRoute = (slugs: string[]) => () =>
  json({
    schema_version: "livemakers_article_topic_index_v1",
    environment: "production",
    topic: "funding",
    generated_at: "2026-10-28T07:00:00+09:00",
    items: slugs.map((slug) => item(slug)),
  });

describe("loadArticleDetailContext", () => {
  const config = { surfacePublished: false };

  it("builds neighbors from the family index, breaking ties by slug like getSeriesNeighbors", async () => {
    enableV2();
    routed({ [`${BASE}/rail.json`]: railRoute, [`${BASE}/families/signal.json`]: familyRoute });
    const context = await loadArticleDetailContext(current(), config);
    expect(context.neighbors.next?.articleId).toBe("signal-20261026-ffffffff");
    expect(context.neighbors.prev?.articleId).toBe("signal-20261025-cccccccc");
    expect(context.neighbors.next?.href).toBe("/articles/signal-20261026-ffffffff");
    expect(context.neighbors.prev?.titleJa).toBe("前の記事");
    expect(context.related[0]?.articleId).toBe("signal-20261027-bbbbbbbb");
    expect(context.railArticles.map((a) => a.articleId)).toContain("flash-20261027-aaaaaaaa");
  });

  it("matches getSeriesNeighbors over the same articles", async () => {
    enableV2();
    routed({ [`${BASE}/rail.json`]: railRoute, [`${BASE}/families/signal.json`]: familyRoute });
    const context = await loadArticleDetailContext(current(), config);
    const expected = getSeriesNeighbors(
      [current(),
        { ...current(), articleId: "signal-20261026-ffffffff" },
        { ...current(), articleId: "signal-20261025-cccccccc", publishedAtJst: "2026-10-25T07:00:00+09:00" }],
      current(),
    );
    expect(context.neighbors.next?.articleId).toBe(expected.next?.articleId);
    expect(context.neighbors.prev?.articleId).toBe(expected.prev?.articleId);
  });

  it("renders without rail items when the rail is 403", async () => {
    enableV2();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    routed({ [`${BASE}/rail.json`]: () => json({}, 403), [`${BASE}/families/signal.json`]: familyRoute });
    const context = await loadArticleDetailContext(current(), config);
    expect(context.related).toEqual([]);
    expect(context.railArticles.filter((a) => (a as { source?: string }).source === "inflow")).toEqual([]);
    expect(context.neighbors.prev?.articleId).toBe("signal-20261025-cccccccc");
    expect(context.surfacePublished).toBe(false);
  });

  it("renders without neighbors when the family index is 403", async () => {
    enableV2();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    routed({ [`${BASE}/rail.json`]: railRoute, [`${BASE}/families/signal.json`]: () => json({}, 403) });
    const context = await loadArticleDetailContext(current(), config);
    expect(context.neighbors).toEqual({ prev: null, next: null });
    expect(context.related[0]?.articleId).toBe("signal-20261027-bbbbbbbb");
  });

  it("opens the future-atlas surface when the rail carries a future-atlas article", async () => {
    enableV2();
    routed({
      [`${BASE}/rail.json`]: () =>
        json({
          schema_version: "livemakers_article_rail_v1",
          environment: "production",
          generated_at: "2026-10-27T07:00:00+09:00",
          latest: [],
          by_family: { "future-atlas": [item("future-atlas-20261027-eeeeeeee", "future-atlas")] },
        }),
    });
    const context = await loadArticleDetailContext(current(), config);
    expect(context.surfacePublished).toBe(true);
  });

  it("topics includes funding when the slug is in the topic index", async () => {
    enableV2();
    routed({
      [`${BASE}/rail.json`]: railRoute,
      [`${BASE}/families/signal.json`]: familyRoute,
      [`${BASE}/topics/funding.json`]: topicRoute([SLUG]),
    });
    const context = await loadArticleDetailContext(current(), config);
    expect(context.topics).toEqual(["funding"]);
  });

  it("topics is empty when the slug is not in the topic index", async () => {
    enableV2();
    routed({
      [`${BASE}/rail.json`]: railRoute,
      [`${BASE}/families/signal.json`]: familyRoute,
      [`${BASE}/topics/funding.json`]: topicRoute(["signal-20261027-bbbbbbbb"]),
    });
    const context = await loadArticleDetailContext(current(), config);
    expect(context.topics).toEqual([]);
  });

  it("topics is empty when the topic index is unavailable (rail and neighbours still render)", async () => {
    enableV2();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    routed({
      [`${BASE}/rail.json`]: railRoute,
      [`${BASE}/families/signal.json`]: familyRoute,
      [`${BASE}/topics/funding.json`]: () => json({}, 403),
    });
    const context = await loadArticleDetailContext(current(), config);
    expect(context.topics).toEqual([]);
    expect(context.neighbors.prev?.articleId).toBe("signal-20261025-cccccccc");
    expect(context.related[0]?.articleId).toBe("signal-20261027-bbbbbbbb");
  });
});
