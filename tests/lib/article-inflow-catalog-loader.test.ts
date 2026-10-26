import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ARTICLE_INFLOW_CATALOG_FAILURE_HOLD_MS,
  ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY,
  ARTICLE_INFLOW_PRODUCTION_FEED_ENV_KEY,
  ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY,
  ArticleInflowUnavailableError,
  fetchProductionArticleInflowFeed,
  loadPublicArticleInflowCatalog,
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
const originalNextPhase = process.env.NEXT_PHASE;

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
  if (originalNextPhase === undefined) {
    delete process.env.NEXT_PHASE;
  } else {
    process.env.NEXT_PHASE = originalNextPhase;
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

  // 2026-10-27: v0 への予備取得はやめた。v0 も同じ Blob にあり、カタログが 403 の
  // ときは v0 も 403 で、失敗 1 回につき Blob へ 2 倍当たっていただけだった
  // (本番ログ・手元の再現)
  it("does not fall back to the v0 feed when the catalog cannot be served", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = routedFetcher({
      [CATALOG_URL]: () => ({ ok: false, status: 403 }) as unknown as Response,
      [FEED_URL]: () => jsonResponse(feedPayload()),
    });
    const source = await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    expect(source).toBeNull();
    const urls = fetcher.mock.calls.map((call) => String(call[0]).split("?")[0]);
    expect(urls).not.toContain(FEED_URL);
  });

  // 2026-10-27: カタログ (1.6MB) はデータキャッシュに載らないので、同じ
  // インスタンスで同時に走る作り直しがそれぞれ取りに行っていた。進行中の取得に
  // 相乗りさせる。終わった結果は持ち越さない (9/22 の焼き付きを避ける)
  it("shares one in-flight catalog fetch among concurrent loads at runtime", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    delete process.env.NEXT_PHASE;
    const fetcher = routedFetcher({
      [CATALOG_URL]: () => jsonResponse(catalogPayload()),
    });
    const loads = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetchProductionArticleInflowFeed(fetcher as typeof fetch)),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    for (const source of loads) {
      expect(source?.feed_checksum).toBe("8f36d3924040c7aa");
    }
  });

  // 記事ページの作り直しが失敗すると、Next.js は 500 用の描画で generateMetadata を
  // もう一度呼ぶ (React の cache をまたぐ)。失敗を短い間だけ覚えて、Blob へ
  // 2 回目を取りに行かない。成功は覚えない (上の「memo しない」テスト)
  it("shares a failure among concurrent loads and holds it briefly before retrying", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    delete process.env.NEXT_PHASE;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let failing = true;
    const fetcher = routedFetcher({
      [CATALOG_URL]: () => failing
        ? ({ ok: false, status: 403 }) as unknown as Response
        : jsonResponse(catalogPayload()),
    });
    const failed = await Promise.all(
      Array.from({ length: 5 }, () =>
        fetchProductionArticleInflowFeed(fetcher as typeof fetch)),
    );
    expect(failed.every((source) => source === null)).toBe(true);
    // 1 回の取得 (2 回試す) を 5 つの読み込みで共有する
    expect(fetcher).toHaveBeenCalledTimes(2);

    failing = false;
    now += ARTICLE_INFLOW_CATALOG_FAILURE_HOLD_MS - 1;
    expect(await fetchProductionArticleInflowFeed(fetcher as typeof fetch)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);

    now += 1;
    const recovered = await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    expect(recovered?.feed_checksum).toBe("8f36d3924040c7aa");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  // 2026-09-22: catalog をプロセス内 memo (120s) に載せると、revalidatePath で
  // 再生成された記事ページが「同じインスタンスの別ページが直前に読んだ旧 catalog」
  // を使い、新記事が 404・取り下げ記事が 200 のまま焼き付いた (14:30 / 14:56 実測)。
  // catalog は data cache に載るサイズ (~460KB) なので memo しない。
  it("does not memoize the catalog: the next load sees a newly published catalog", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    let served = 0;
    const fetcher = routedFetcher({
      [CATALOG_URL]: () => {
        served += 1;
        return jsonResponse({
          ...catalogPayload(),
          feed_checksum: served === 1 ? "1111111111111111" : "2222222222222222",
        });
      },
    });
    delete process.env.NEXT_PHASE;
    const first = await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    const second = await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    expect(first?.feed_checksum).toBe("1111111111111111");
    expect(second?.feed_checksum).toBe("2222222222222222");
  });

  // 2026-10-26: catalog は 1.6MB に育ち、data cache 上限 (2MB) を超えた
  // (キャッシュ用の形で 2.17MB・"items over 2MB can not be cached")。`next build`
  // では約 1,000 ページがページごとに catalog を取りに行き、Blob に 403 で拒否され
  // てトップが repository-only で焼かれていた。ビルドは 1 回きりの snapshot で
  // revalidatePath も来ないので、ビルド中だけ memo + single-flight で 1 回に絞る。
  it("fetches the catalog once per process during next build", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    process.env.NEXT_PHASE = "phase-production-build";
    const fetcher = routedFetcher({
      [CATALOG_URL]: () => jsonResponse(catalogPayload()),
    });
    const loads = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetchProductionArticleInflowFeed(fetcher as typeof fetch)),
    );
    const later = await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
    for (const source of [...loads, later]) {
      expect(source?.feed_checksum).toBe("8f36d3924040c7aa");
    }
  });

  it("still memoizes the v0 fallback feed (too large for the data cache)", async () => {
    enablePublic();
    delete process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY];
    const fetcher = routedFetcher({
      [FEED_URL]: () => jsonResponse(feedPayload()),
    });
    await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    await fetchProductionArticleInflowFeed(fetcher as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
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

// 2026-10-26 (PR-A): Vercel 上では記事カタログの取得が 1 日中たびたび 403 で
// 拒否されている (ランタイムログ)。取得に失敗した作り直しをリポジトリ内の記事
// だけで描くと、その古いページがキャッシュされて次の作り直しまで残る (21:46 の
// /ja)。実行時はエラーにして作り直しをやめ、Next.js に前の正常なページを
// 出し続けさせる。ビルド中・公開フラグ OFF・検索 (毎回描く) は従来どおり退避する
describe("catalog unavailable at runtime keeps the previous page", () => {
  function failingEverything() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403 }) as unknown as Response),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  }

  it("throws instead of rendering repository-only content", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    delete process.env.NEXT_PHASE;
    failingEverything();
    await expect(loadPublicArticleInflowCatalog()).rejects.toBeInstanceOf(
      ArticleInflowUnavailableError,
    );
    await expect(loadPublicArticleInflowDetail(SLUG, "ja")).rejects.toBeInstanceOf(
      ArticleInflowUnavailableError,
    );
  });

  it("degrades to repository-only when the caller opts in (search renders per request)", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    delete process.env.NEXT_PHASE;
    failingEverything();
    const catalog = await loadPublicArticleInflowCatalog({ onUnavailable: "degrade" });
    expect(catalog.feedPresent).toBe(false);
    expect(catalog.articles.length).toBeGreaterThan(0);
  });

  it("still degrades during next build (a failed build is worse than a stale prerender)", async () => {
    enablePublic();
    process.env[ARTICLE_INFLOW_PRODUCTION_CATALOG_ENV_KEY] = CATALOG_URL;
    process.env.NEXT_PHASE = "phase-production-build";
    failingEverything();
    const catalog = await loadPublicArticleInflowCatalog();
    expect(catalog.feedPresent).toBe(false);
  });

  it("does not throw when the public feed is switched off", async () => {
    process.env[ARTICLE_INFLOW_PUBLIC_FLAG_ENV_KEY] = "0";
    delete process.env.NEXT_PHASE;
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const catalog = await loadPublicArticleInflowCatalog();
    expect(catalog.feedPresent).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
