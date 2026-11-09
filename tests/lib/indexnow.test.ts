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

describe("the public key file", () => {
  it("has a 32-hex key and serves exactly that key", () => {
    expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/);
    const file = readFileSync(join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`), "utf8");
    expect(file.trim()).toBe(INDEXNOW_KEY);
  });
});
