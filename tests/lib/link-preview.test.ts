import { afterEach, describe, expect, it, vi } from "vitest";

// Next の unstable_cache は globalThis.AsyncLocalStorage (Next の実行環境が置く)
// を読み込み時に掴む。テストでは本物を先に置き、unstable_cache をそのまま通す。
await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});

import {
  fetchLinkPreview,
  getLinkPreview,
  isFetchableUrl,
  loadLinkPreview,
  parseLinkPreview,
  TransientLinkPreviewError,
  type FetchLike,
} from "@/lib/articles/link-preview";

const PAGE = "https://www.bepal.net/archives/726905";

function htmlResponse(body: BodyInit, init: { status?: number; type?: string } = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": init.type ?? "text/html; charset=utf-8" },
  });
}

describe("isFetchableUrl", () => {
  it("accepts public https urls only", () => {
    expect(isFetchableUrl(PAGE)).toBe(true);
    for (const url of [
      "http://example.com/",
      "https://127.0.0.1/",
      "https://127.1/",
      "https://2130706433/",
      "https://0x7f000001/",
      "https://[::1]/",
      "https://localhost/",
      "https://app.localhost/",
      "https://nas.local/",
      "https://svc.internal/",
      "ftp://example.com/",
      "not a url",
    ]) {
      expect(isFetchableUrl(url), url).toBe(false);
    }
  });
});

describe("parseLinkPreview", () => {
  it("reads og:image and og:site_name regardless of attribute order", () => {
    const html =
      '<meta property="og:image" content="https://img.example.com/a.jpg">' +
      '<meta content="BE-PAL" property="og:site_name">';
    expect(parseLinkPreview(html, PAGE)).toEqual({
      image: "https://img.example.com/a.jpg",
      siteName: "BE-PAL",
    });
  });

  it("falls back to twitter:image, resolves relative paths and decodes &amp;", () => {
    const html = '<meta name="twitter:image" content="/img/a.jpg?w=1&amp;h=2">';
    expect(parseLinkPreview(html, PAGE)).toEqual({
      image: "https://www.bepal.net/img/a.jpg?w=1&h=2",
      siteName: "bepal.net",
    });
  });

  it("decodes numeric character references like Python's html.unescape", () => {
    const html =
      '<meta property="og:image" content="https://i.example.com/a.jpg?w=1&#038;h=2&#x26;q=3">' +
      '<meta property="og:site_name" content="A&#x27;s &#12354; &amp;#38;">';
    expect(parseLinkPreview(html, PAGE)).toEqual({
      image: "https://i.example.com/a.jpg?w=1&h=2&q=3",
      siteName: "A's \u3042 &#38;",
    });
  });

  it("caps og:site_name at 80 characters", () => {
    const html = `<meta property="og:site_name" content="${"あ".repeat(100)}">`;
    expect(parseLinkPreview(html, PAGE).siteName).toBe("あ".repeat(80));
  });

  it("prefers og:image and drops http images", () => {
    const both =
      '<meta name="twitter:image" content="https://t.example.com/t.jpg">' +
      '<meta property="og:image" content="https://o.example.com/o.jpg">';
    expect(parseLinkPreview(both, PAGE).image).toBe("https://o.example.com/o.jpg");
    expect(
      parseLinkPreview('<meta property="og:image" content="http://i.example.com/a.jpg">', PAGE).image,
    ).toBeNull();
  });
});

describe("fetchLinkPreview", () => {
  it("returns the parsed preview, passes a timeout signal and no Next data-cache option", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      htmlResponse('<meta property="og:image" content="https://img.example.com/a.jpg">'),
    );
    await expect(fetchLinkPreview(PAGE, fetchImpl)).resolves.toEqual({
      image: "https://img.example.com/a.jpg",
      siteName: "bepal.net",
    });
    const init = fetchImpl.mock.calls[0][1] as (RequestInit & { next?: unknown }) | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init).not.toHaveProperty("next");
    expect(init).not.toHaveProperty("cache");
  });

  it("never fetches urls that are not fetchable", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    await expect(fetchLinkPreview("http://example.com/x", fetchImpl)).resolves.toEqual({
      image: null,
      siteName: "example.com",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back on errors, non-2xx and non-HTML responses", async () => {
    const og = '<meta property="og:image" content="https://i.example.com/a.jpg">';
    const cases: FetchLike[] = [
      async () => {
        throw new DOMException("timeout", "TimeoutError");
      },
      async () => htmlResponse(og, { status: 404 }),
      async () => htmlResponse(og, { type: "application/json" }),
    ];
    for (const fetchImpl of cases) {
      await expect(fetchLinkPreview(PAGE, fetchImpl)).resolves.toEqual({
        image: null,
        siteName: "bepal.net",
      });
    }
  });

  it("reads at most 512KB of the page", async () => {
    const late = `${"x".repeat(600 * 1024)}<meta property="og:image" content="https://i.example.com/late.jpg">`;
    const result = await fetchLinkPreview(PAGE, async () => htmlResponse(late));
    expect(result.image).toBeNull();
  });

  it("decodes pages with the charset declared in Content-Type (Shift_JIS)", async () => {
    // 「ビーパル」の Shift_JIS バイト列
    const head = new TextEncoder().encode('<meta property="og:site_name" content="');
    const name = new Uint8Array([0x83, 0x72, 0x81, 0x5b, 0x83, 0x70, 0x83, 0x8b]);
    const tail = new TextEncoder().encode('">');
    const body = new Uint8Array([...head, ...name, ...tail]);
    const result = await fetchLinkPreview(PAGE, async () =>
      htmlResponse(body, { type: "text/html; charset=Shift_JIS" }),
    );
    expect(result.siteName).toBe("ビーパル");
  });
});

describe("loadLinkPreview (the cached core)", () => {
  it("throws on transient failures so they are not cached", async () => {
    const og = '<meta property="og:image" content="https://i.example.com/a.jpg">';
    const transient: FetchLike[] = [
      async () => {
        throw new TypeError("fetch failed");
      },
      async () => {
        throw new DOMException("timeout", "TimeoutError");
      },
      async () => htmlResponse(og, { status: 503 }),
      async () => htmlResponse(og, { status: 429 }),
    ];
    for (const fetchImpl of transient) {
      await expect(loadLinkPreview(PAGE, fetchImpl)).rejects.toBeInstanceOf(
        TransientLinkPreviewError,
      );
    }
  });

  it("returns (cacheable) fallbacks for deterministic outcomes", async () => {
    const og = '<meta property="og:image" content="https://i.example.com/a.jpg">';
    const fallback = { image: null, siteName: "bepal.net" };
    await expect(loadLinkPreview(PAGE, async () => htmlResponse(og, { status: 404 }))).resolves.toEqual(fallback);
    await expect(
      loadLinkPreview(PAGE, async () => htmlResponse(og, { type: "application/json" })),
    ).resolves.toEqual(fallback);
    await expect(loadLinkPreview(PAGE, async () => htmlResponse("<p>no og</p>"))).resolves.toEqual(fallback);
  });
});

describe("getLinkPreview (unstable_cache wrapper)", () => {
  type Entry = { value: unknown };
  const g = globalThis as { __incrementalCache?: unknown };

  // unstable_cache は描画外では globalThis.__incrementalCache を使う — 最小の
  // メモリ実装を差し込み、本物の unstable_cache を通して「何が残るか」を見る。
  function installFakeIncrementalCache() {
    const store = new Map<string, Entry>();
    g.__incrementalCache = {
      isOnDemandRevalidate: false,
      generateCacheKey: async (key: string) => key,
      get: async (key: string) => (store.has(key) ? { isStale: false, ...store.get(key) } : null),
      set: async (key: string, value: unknown) => {
        store.set(key, { value });
      },
    };
    return store;
  }

  afterEach(() => {
    delete g.__incrementalCache;
    vi.unstubAllGlobals();
  });

  it("falls back without caching a transient failure, then caches the next success", async () => {
    const store = installFakeIncrementalCache();
    const url = "https://transient.example.com/a";
    const fetchMock = vi
      .fn<FetchLike>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue(htmlResponse('<meta property="og:image" content="https://i.example.com/a.jpg">'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLinkPreview(url)).resolves.toEqual({ image: null, siteName: "transient.example.com" });
    expect(store.size).toBe(0);

    const ok = { image: "https://i.example.com/a.jpg", siteName: "transient.example.com" };
    await expect(getLinkPreview(url)).resolves.toEqual(ok);
    expect(store.size).toBe(1);
    await expect(getLinkPreview(url)).resolves.toEqual(ok);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches deterministic outcomes such as a 404", async () => {
    const store = installFakeIncrementalCache();
    const fetchMock = vi.fn<FetchLike>(async () => htmlResponse("gone", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const url = "https://gone.example.com/a";
    await expect(getLinkPreview(url)).resolves.toEqual({ image: null, siteName: "gone.example.com" });
    await expect(getLinkPreview(url)).resolves.toEqual({ image: null, siteName: "gone.example.com" });
    expect(store.size).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
