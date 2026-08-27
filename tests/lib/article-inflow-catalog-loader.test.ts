import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY,
  ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY,
  ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY,
  fetchProductionArticleInflowFeed,
  loadPublicArticleInflowDetail,
  resetArticleInflowFeedMemo,
} from "@/lib/articles/article-inflow-feed";
import {
  ARTICLE_BLOB_ORIGIN,
  ARTICLE_INFLOW_BODY_SCHEMA_VERSION,
  ARTICLE_INFLOW_CATALOG_SCHEMA_VERSION,
} from "@/lib/articles/article-inflow-validation.mjs";

const CATALOG_URL = "https://example.test/catalog.v1.json";
const FEED_URL = "https://example.test/feed.v0.json";
const BODY = "# Catalog body\n\nExact bytes.\n";
const CHECKSUM = createHash("sha256").update(BODY, "utf8").digest("hex");
const SLUG = "signal-20260827-abcd1234";
const BODY_URL = `${ARTICLE_BLOB_ORIGIN}/livemakers/article_inflow/bodies/${SLUG}.${CHECKSUM.slice(0, 16)}.json`;

const originalCatalogUrl = process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY];
const originalFeedUrl = process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY];
const originalPublicFlag = process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];

function catalogPayload() {
  return {
    schema_version: ARTICLE_INFLOW_CATALOG_SCHEMA_VERSION,
    environment: "production",
    generated_at: "2026-08-27T18:00:00+09:00",
    feed_checksum: "8f36d3924040c7aa",
    source_feed_checksum: "aabbccddeeff0011",
    articles: [{
      slug: SLUG,
      title: "Signal",
      family: "signal",
      source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
      published_at: "2026-08-27T07:05:00+09:00",
      body_checksum: CHECKSUM,
      body_url: BODY_URL,
      validator: { verdict: "green", vocabulary_version: "v1" },
    }],
  };
}

function bodyPayload() {
  return {
    schema_version: ARTICLE_INFLOW_BODY_SCHEMA_VERSION,
    slug: SLUG,
    body_checksum: CHECKSUM,
    body: BODY,
  };
}

function feedPayload() {
  return {
    schema_version: "livemakers_article_inflow_feed_v0",
    environment: "production",
    generated_at: "2026-08-27T18:00:00+09:00",
    feed_checksum: "aabbccddeeff0011",
    articles: [{
      slug: SLUG,
      title: "Signal",
      family: "signal",
      source_x_url: "https://x.com/SITIONjp/status/2078605793587503344",
      published_at: "2026-08-27T07:05:00+09:00",
      body: BODY,
      body_checksum: CHECKSUM,
      validator: { verdict: "green", vocabulary_version: "v1" },
    }],
  };
}

function jsonResponse(payload: unknown) {
  return { ok: true, json: async () => payload } as unknown as Response;
}

function routedFetcher(routes: Record<string, () => Response | never>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input).split("?")[0];
    const route = routes[url];
    if (!route) throw new Error(`unexpected fetch: ${url}`);
    return route();
  });
}

afterEach(() => {
  if (originalCatalogUrl === undefined) {
    delete process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY];
  } else {
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = originalCatalogUrl;
  }
  if (originalFeedUrl === undefined) {
    delete process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY];
  } else {
    process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = originalFeedUrl;
  }
  if (originalPublicFlag === undefined) {
    delete process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY];
  } else {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = originalPublicFlag;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetArticleInflowFeedMemo();
});

function enablePublic() {
  process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "1";
  process.env[ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY] = FEED_URL;
}

describe("catalog v1 loader", () => {
  it("serves the catalog when the catalog env is set (v0 untouched)", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    const fetcher = routedFetcher({
      [CATALOG_URL]: () => jsonResponse(catalogPayload()),
    });
    const source = await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    expect(source?.articles).toHaveLength(1);
    expect(source?.feed_checksum).toBe("8f36d3924040c7aa");
    const urls = fetcher.mock.calls.map((call) => String(call[0]).split("?")[0]);
    expect(urls).not.toContain(FEED_URL);
  });

  it("falls back to the v0 feed when the catalog cannot be served", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = routedFetcher({
      [CATALOG_URL]: () => ({ ok: false, status: 500 }) as unknown as Response,
      [FEED_URL]: () => jsonResponse(feedPayload()),
    });
    const source = await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    expect(source?.feed_checksum).toBe("aabbccddeeff0011");
    expect(warning.mock.calls.flat().join(" ")).toContain("falling back");
  });

  it("keeps the exact current behavior when the catalog env is unset", async () => {
    enablePublic();
    delete process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY];
    const fetcher = routedFetcher({
      [FEED_URL]: () => jsonResponse(feedPayload()),
    });
    const source = await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    expect(source?.feed_checksum).toBe("aabbccddeeff0011");
    expect(source?.articles[0].body).toBe(BODY);
  });
});

describe("detail body fetch over catalog v1", () => {
  it("fetches, verifies, and renders the per-article body", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    vi.stubGlobal("fetch", routedFetcher({
      [CATALOG_URL]: () => jsonResponse(catalogPayload()),
      [BODY_URL]: () => jsonResponse(bodyPayload()),
    }));
    const detail = await loadPublicArticleInflowDetail(SLUG, "ja");
    expect(detail?.body).toBe(BODY);
    expect(detail?.declaredBodyChecksum).toBe(CHECKSUM);
    expect(detail?.renderedBodyChecksum).toBe(CHECKSUM);
  });

  it("returns null (→ notFound) when the body blob fails verification", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const tampered = { ...bodyPayload(), body: "# tampered\n" };
    vi.stubGlobal("fetch", routedFetcher({
      [CATALOG_URL]: () => jsonResponse(catalogPayload()),
      [BODY_URL]: () => jsonResponse(tampered),
    }));
    const detail = await loadPublicArticleInflowDetail(SLUG, "ja");
    expect(detail).toBeNull();
    expect(warning).toHaveBeenCalled();
  });
});
