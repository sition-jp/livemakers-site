import { afterEach, describe, expect, it, vi } from "vitest";

// Next の next/server は読み込み時に globalThis.AsyncLocalStorage (Next の実行環境が
// 置く) を掴む。テストでは本物を先に置く (tests/lib/link-preview.test.ts と同じ)。
await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});

import { NextRequest, type NextFetchEvent } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import createMiddleware from "next-intl/middleware";

import proxy, { config } from "@/proxy";
import { RECORDED_FILES } from "@/lib/bot-visits";
import { routing } from "@/i18n/routing";

const GPTBOT_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";
const HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TOKEN = "proxy-test-token-xyz";

function request(path: string, ua: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://livemakers.com${path}`, {
    headers: { "user-agent": ua, ...headers },
  });
}

function fakeEvent() {
  const promises: Promise<unknown>[] = [];
  const waitUntil = vi.fn((p: Promise<unknown>) => {
    promises.push(p);
  });
  return { event: { waitUntil } as unknown as NextFetchEvent, waitUntil, promises };
}

function configureIngest(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubEnv("BOT_VISIT_INGEST_URL", "https://ingest.example.test/internal/bot-visits");
  vi.stubEnv("BOT_VISIT_INGEST_TOKEN", TOKEN);
  vi.stubEnv("BOT_VISIT_INGEST_ENABLED", "1");
  vi.stubGlobal("fetch", fetchMock);
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("proxy — the four files bypass locale routing", () => {
  for (const file of RECORDED_FILES) {
    it(`GPTBot ${file}: served unchanged and recorded once as kind=file`, async () => {
      const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
      configureIngest(fetchMock);
      const { event, waitUntil, promises } = fakeEvent();
      const res = await proxy(request(file, GPTBOT_UA), event);
      expect(isRedirect(res.status)).toBe(false);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(waitUntil).toHaveBeenCalledTimes(1);
      await Promise.all(promises);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(
        (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
      );
      expect(body).toMatchObject({ bot: "GPTBot", kind: "file", path: file });
    });

    it(`human ${file}: served unchanged, nothing recorded`, async () => {
      const { event, waitUntil } = fakeEvent();
      const res = await proxy(request(file, HUMAN_UA), event);
      expect(isRedirect(res.status)).toBe(false);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(waitUntil).not.toHaveBeenCalled();
    });
  }
});

describe("proxy — pages keep the existing locale routing", () => {
  const intl = createMiddleware(routing);

  for (const path of ["/ja", "/", "/articles/x", "/en/articles/y"]) {
    it(`human ${path}: same response as next-intl alone, nothing recorded`, async () => {
      const { event, waitUntil } = fakeEvent();
      const res = await proxy(request(path, HUMAN_UA), event);
      const expected = intl(request(path, HUMAN_UA));
      expect(res.status).toBe(expected.status);
      expect(res.headers.get("location")).toBe(expected.headers.get("location"));
      expect(res.headers.get("x-middleware-next")).toBe(
        expected.headers.get("x-middleware-next"),
      );
      expect(waitUntil).not.toHaveBeenCalled();
    });
  }

  it("GPTBot /: the locale redirect is returned as is and recorded as kind=redirect", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    configureIngest(fetchMock);
    const { event, waitUntil, promises } = fakeEvent();
    const res = await proxy(request("/", GPTBOT_UA), event);
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get("location")).toBe("https://livemakers.com/ja");
    expect(waitUntil).toHaveBeenCalledTimes(1);
    await Promise.all(promises);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ kind: "redirect", path: "/" });
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(init.body as string).not.toContain(TOKEN);
  });

  it("GPTBot /ja/articles/x: routed as before and recorded as kind=page", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    configureIngest(fetchMock);
    const { event, promises } = fakeEvent();
    const res = await proxy(request("/ja/articles/x", GPTBOT_UA), event);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    await Promise.all(promises);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      kind: "page",
      category: "training",
      path: "/ja/articles/x",
    });
  });

  it("GPTBot prefetch (RSC: 1) is not recorded", async () => {
    const { event, waitUntil } = fakeEvent();
    await proxy(request("/ja", GPTBOT_UA, { RSC: "1" }), event);
    expect(waitUntil).not.toHaveBeenCalled();
  });
});

describe("proxy — failures never change the response", () => {
  it("a failing receiver: the response is normal and the background promise resolves", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    configureIngest(fetchMock);
    const { event, promises } = fakeEvent();
    const res = await proxy(request("/robots.txt", GPTBOT_UA), event);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    await expect(Promise.all(promises)).resolves.toBeDefined();
  });

  it("event.waitUntil throwing does not throw out of the proxy", async () => {
    const event = {
      waitUntil: () => {
        throw new Error("no waitUntil here");
      },
    } as unknown as NextFetchEvent;
    const res = await proxy(request("/ja", GPTBOT_UA), event);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy config.matcher", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it("runs on the four recorded files", () => {
    for (const file of RECORDED_FILES) expect(matches(file)).toBe(true);
  });

  it("still runs on pages", () => {
    for (const url of ["/", "/ja", "/ja/articles/x", "/en"]) expect(matches(url)).toBe(true);
  });

  it("does not run on _next, api, _vercel or other dotted files", () => {
    for (const url of [
      "/_next/static/chunks/main.js",
      "/_next/image",
      "/api/revalidate",
      "/_vercel/insights/script.js",
      "/icon.svg",
      "/favicon.ico",
      "/robots.txt.bak",
    ]) {
      expect(matches(url)).toBe(false);
    }
  });

  it("lists each recorded file literally (Next reads the matcher statically)", () => {
    for (const file of RECORDED_FILES) expect(config.matcher).toContain(file);
  });
});
