import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));

import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  indexNowUrlsFromPaths,
  notifyIndexNowAfterResponse,
  submitIndexNow,
} from "@/lib/seo/indexnow";

const SLUG = "signal-20261110-0123abcd";
const URL_JA = `https://livemakers.com/ja/articles/${SLUG}`;

afterEach(() => {
  mocks.after.mockClear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("indexNowUrlsFromPaths", () => {
  it("keeps only the canonical /ja article URLs, deduped", () => {
    expect(
      indexNowUrlsFromPaths([
        "/ja",
        `/ja/articles/${SLUG}`,
        `/en/articles/${SLUG}`,
        `/ja/articles/${SLUG}`,
        "/ja/articles/series/signal",
        "/ja/articles/today",
      ]),
    ).toEqual([URL_JA]);
  });

  it("drops an article that was signalled only under /en", () => {
    expect(indexNowUrlsFromPaths([`/en/articles/${SLUG}`])).toEqual([]);
  });

  it("caps one submission at 100 URLs", () => {
    const paths = Array.from({ length: 130 }, (_, i) =>
      `/ja/articles/signal-20261110-${i.toString(16).padStart(8, "0")}`,
    );
    expect(indexNowUrlsFromPaths(paths)).toHaveLength(100);
  });
});

describe("submitIndexNow", () => {
  it("does not send outside production", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const env of ["preview", "development", undefined]) {
      expect(await submitIndexNow([URL_JA], { fetchImpl, env })).toEqual({ sent: 0, status: null });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not send an empty list", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await submitIndexNow([], { fetchImpl, env: "production" })).toEqual({ sent: 0, status: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts host, key, keyLocation and urlList in production", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    const result = await submitIndexNow([URL_JA], { fetchImpl, env: "production" });
    expect(result).toEqual({ sent: 1, status: 202 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(INDEXNOW_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      host: "livemakers.com",
      key: INDEXNOW_KEY,
      keyLocation: `https://livemakers.com/${INDEXNOW_KEY}.txt`,
      urlList: [URL_JA],
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports nothing sent when the endpoint rejects the request", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 403 }));
    expect(await submitIndexNow([URL_JA], { fetchImpl, env: "production" })).toEqual({ sent: 0, status: 403 });
  });

  it("never throws when the endpoint is down", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("down");
    });
    expect(await submitIndexNow([URL_JA], { fetchImpl, env: "production" })).toEqual({ sent: 0, status: null });
  });
});

describe("notifyIndexNowAfterResponse", () => {
  it("schedules nothing when no article path was signalled", () => {
    notifyIndexNowAfterResponse(["/ja", "/ja/articles/series/signal"]);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("schedules one submission after the response for article paths", () => {
    notifyIndexNowAfterResponse([`/ja/articles/${SLUG}`, `/en/articles/${SLUG}`]);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(typeof mocks.after.mock.calls[0][0]).toBe("function");
  });
});

describe("the scheduled submission (signal → canonical URL → IndexNow)", () => {
  it("posts the canonical URL when the scheduled callback runs in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    notifyIndexNowAfterResponse([`/ja/articles/${SLUG}`, `/en/articles/${SLUG}`]);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    await mocks.after.mock.calls[0][0]();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(INDEXNOW_ENDPOINT);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).urlList).toEqual([URL_JA]);
  });

  it("does not post from a preview deployment even when the callback runs", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    notifyIndexNowAfterResponse([`/ja/articles/${SLUG}`, `/en/articles/${SLUG}`]);
    await mocks.after.mock.calls[0][0]();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("failures are visible in the logs", () => {
  it("warns once when the endpoint does not accept the submission", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 403 }));
    await submitIndexNow([URL_JA], { fetchImpl, env: "production" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("[indexnow]");
    expect(String(warn.mock.calls[0][0])).toContain("403");
  });

  it("warns once when the request fails or times out", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("down");
    });
    await submitIndexNow([URL_JA], { fetchImpl, env: "production" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("[indexnow]");
  });

  it("stays quiet when the submission is accepted or not attempted", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const accepted = vi.fn<typeof fetch>(async () => new Response(null, { status: 202 }));
    await submitIndexNow([URL_JA], { fetchImpl: accepted, env: "production" });
    await submitIndexNow([URL_JA], { fetchImpl: accepted, env: "preview" });
    await submitIndexNow([], { fetchImpl: accepted, env: "production" });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("the public key file", () => {
  it("has a 32-hex key and serves exactly that key", () => {
    expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/);
    const file = readFileSync(join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`), "utf8");
    expect(file.trim()).toBe(INDEXNOW_KEY);
  });
});
