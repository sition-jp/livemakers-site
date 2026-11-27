import { afterEach, describe, expect, it, vi } from "vitest";

await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});

vi.mock("server-only", () => ({}));

import { NextRequest, type NextFetchEvent } from "next/server";

import proxy from "@/proxy";
import { checkForecastLab, FORECAST_LAB_PATH } from "@/lib/forecast-lab/gate";
import { FEED_URL, loadForecastFeed } from "@/lib/forecast-lab/feed";
import { averageProbability, compareWord, leadItem, usualLine } from "@/lib/forecast-lab/view";
import { ROBOTS_DISALLOW } from "@/lib/ai-bots";

const basic = (pw: string) => `Basic ${btoa(`lvm:${pw}`)}`;
const event = { waitUntil: vi.fn() } as unknown as NextFetchEvent;
const req = (path: string, auth?: string) =>
  new NextRequest(`https://livemakers.com${path}`, { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("forecast-lab gate", () => {
  it("is closed (404) when no password is configured", () => {
    expect(checkForecastLab(basic("x"), undefined)).toEqual({ ok: false, status: 404 });
  });
  it("asks for a password (401) and accepts only the right one", () => {
    expect(checkForecastLab(null, "s3cret")).toEqual({ ok: false, status: 401 });
    expect(checkForecastLab(basic("wrong"), "s3cret")).toEqual({ ok: false, status: 401 });
    expect(checkForecastLab("Basic !!!", "s3cret")).toEqual({ ok: false, status: 401 });
    expect(checkForecastLab(basic("s3cret"), "s3cret")).toEqual({ ok: true });
  });
  it("matches only the forecast-lab paths and is kept out of robots", () => {
    expect(FORECAST_LAB_PATH.test("/ja/forecast-lab")).toBe(true);
    expect(FORECAST_LAB_PATH.test("/en/forecast-lab/x")).toBe(true);
    expect(FORECAST_LAB_PATH.test("/ja/forecast-labs")).toBe(false);
    expect(ROBOTS_DISALLOW).toContain("/ja/forecast-lab");
  });
});

describe("proxy on /ja/forecast-lab", () => {
  it("404 without a configured password, 401 without auth, noindex either way", async () => {
    let res = await proxy(req("/ja/forecast-lab"), event);
    expect(res.status).toBe(404);
    vi.stubEnv("FORECAST_APP_PASSWORD", "s3cret");
    res = await proxy(req("/ja/forecast-lab"), event);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Basic");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("passes through with the right password and is never cached publicly", async () => {
    vi.stubEnv("FORECAST_APP_PASSWORD", "s3cret");
    const res = await proxy(req("/ja/forecast-lab", basic("s3cret")), event);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("forecast-lab feed", () => {
  it("returns null without a read token and never calls GitHub", async () => {
    const f = vi.fn();
    expect(await loadForecastFeed({}, f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("reads the private ledger file with the token and checks the schema", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ schema: "lfa_v1", today: { items: [] } })));
    const feed = await loadForecastFeed({ FORECAST_LEDGER_READ_TOKEN: "t" }, f as unknown as typeof fetch);
    expect(feed?.schema).toBe("lfa_v1");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(FEED_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
    expect(init.cache).toBe("no-store");
    const bad = vi.fn(async () => new Response(JSON.stringify({ schema: "other" })));
    expect(await loadForecastFeed({ FORECAST_LEDGER_READ_TOKEN: "t" }, bad as unknown as typeof fetch)).toBeNull();
    const down = vi.fn(async () => new Response("no", { status: 404 }));
    expect(await loadForecastFeed({ FORECAST_LEDGER_READ_TOKEN: "t" }, down as unknown as typeof fetch)).toBeNull();
  });
});

describe("forecast-lab words", () => {
  const item = (diff: number | null) => ({ asset: "BTC", event: "turn" as const, event_ja: "", horizon: "30D" as const,
    probability: 0.3, base_rate: 0.48, diff_pt: diff, text: null, due_at: null, model_version: "it-2026-10",
    base_info: { start: "2021-12-28", end: "2025-10-16", days: 1329 } });
  it("says what the usual rate counted, or that the period is unknown", () => {
    expect(usualLine(item(0).base_info)).toBe(
      "ふだんの確率 = 2021 年 12 月〜2025 年 10 月の 1,329 日のうち、この出来事が実際に起きた日の割合");
    expect(usualLine(null)).toBe("ふだんの確率の期間の記録がありません");
  });
  it("leads with the biggest gap only when it is 5 points or more", () => {
    expect(leadItem([item(-18.4), item(2)])?.diff_pt).toBe(-18.4);
    expect(leadItem([item(4.9), item(-3)])).toBeNull();
    expect(compareWord(5).word).toBe("ふだんより高い");
    expect(compareWord(-4.9).word).toBe("ふだんと同じくらい");
  });
  it("weights the average probability by count", () => {
    expect(averageProbability([{ p: 0.5, n: 1, hits: 1, rate: 1 }, { p: 0.8, n: 3, hits: 2, rate: 0.67 }])).toBeCloseTo(0.725);
    expect(averageProbability(null)).toBeNull();
  });
});

describe("forecast-lab feed (local file for development only)", () => {
  it("is ignored in production", async () => {
    const f = vi.fn();
    expect(await loadForecastFeed({ NODE_ENV: "production", FORECAST_FEED_FILE: "/nope.json" },
      f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
