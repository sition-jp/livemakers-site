import { describe, expect, it, vi } from "vitest";

import {
  RECORDED_FILES,
  buildBotVisit,
  sendBotVisit,
  type BotVisit,
} from "@/lib/bot-visits";

const GPTBOT_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";
const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const HUMAN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function req(
  path: string,
  init: { method?: string; ua?: string | null; headers?: Record<string, string> } = {},
): Request {
  const headers = new Headers(init.headers);
  if (init.ua !== null) headers.set("user-agent", init.ua ?? GPTBOT_UA);
  return new Request(`https://livemakers.com${path}`, {
    method: init.method ?? "GET",
    headers,
  });
}

const NO_ENV: Record<string, string | undefined> = {};

describe("RECORDED_FILES", () => {
  it("lists the four files served unchanged", () => {
    expect([...RECORDED_FILES]).toEqual([
      "/robots.txt",
      "/llms.txt",
      "/sitemap.xml",
      "/sitemap-news.xml",
    ]);
  });
});

describe("buildBotVisit", () => {
  it("records a GPTBot page view in full (sample 1)", () => {
    expect(buildBotVisit(req("/ja/articles/x"), "page", NO_ENV, () => 0.99)).toEqual({
      site: "livemakers",
      bot: "GPTBot",
      category: "training",
      kind: "page",
      sample: 1,
      path: "/ja/articles/x",
      ua: GPTBOT_UA,
    });
  });

  it("records HEAD", () => {
    expect(buildBotVisit(req("/ja", { method: "HEAD" }), "page", NO_ENV)).not.toBeNull();
  });

  it("ignores POST and other methods", () => {
    expect(buildBotVisit(req("/ja", { method: "POST" }), "page", NO_ENV)).toBeNull();
    expect(buildBotVisit(req("/ja", { method: "OPTIONS" }), "page", NO_ENV)).toBeNull();
  });

  it("ignores Next.js prefetches (?_rsc= and RSC: 1)", () => {
    expect(buildBotVisit(req("/ja?_rsc=abc"), "page", NO_ENV)).toBeNull();
    expect(buildBotVisit(req("/ja?x=1&_rsc=abc"), "page", NO_ENV)).toBeNull();
    expect(
      buildBotVisit(req("/ja", { headers: { RSC: "1" } }), "page", NO_ENV),
    ).toBeNull();
  });

  it("never records people or requests without a User-Agent", () => {
    expect(buildBotVisit(req("/ja", { ua: HUMAN_UA }), "page", NO_ENV, () => 0)).toBeNull();
    expect(buildBotVisit(req("/ja", { ua: null }), "page", NO_ENV, () => 0)).toBeNull();
    expect(buildBotVisit(req("/ja", { ua: "" }), "page", NO_ENV, () => 0)).toBeNull();
  });

  it("samples search engines 1 in 10 by default", () => {
    const kept = buildBotVisit(req("/ja", { ua: GOOGLEBOT_UA }), "page", NO_ENV, () => 0.05);
    expect(kept).toMatchObject({ bot: "Googlebot", category: "search_engine", sample: 10 });
    expect(
      buildBotVisit(req("/ja", { ua: GOOGLEBOT_UA }), "page", NO_ENV, () => 0.5),
    ).toBeNull();
  });

  it("samples preview and other_bot too, but never the AI categories", () => {
    const slack = buildBotVisit(
      req("/ja", { ua: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" }),
      "page",
      NO_ENV,
      () => 0.5,
    );
    expect(slack).toBeNull();
    const other = buildBotVisit(req("/ja", { ua: "SomeNewCrawler/1.0" }), "page", NO_ENV, () => 0.01);
    expect(other).toMatchObject({ category: "other_bot", sample: 10 });
    // AI categories are kept even when random is high.
    expect(buildBotVisit(req("/ja"), "page", NO_ENV, () => 0.999)).toMatchObject({ sample: 1 });
  });

  it("uses BOT_VISIT_SAMPLE_RATE when it is an integer 1..1000, else 10", () => {
    const g = () => req("/ja", { ua: GOOGLEBOT_UA });
    expect(buildBotVisit(g(), "page", { BOT_VISIT_SAMPLE_RATE: "100" }, () => 0.005)).toMatchObject({
      sample: 100,
    });
    expect(buildBotVisit(g(), "page", { BOT_VISIT_SAMPLE_RATE: "100" }, () => 0.05)).toBeNull();
    expect(buildBotVisit(g(), "page", { BOT_VISIT_SAMPLE_RATE: "1" }, () => 0.999)).toMatchObject({
      sample: 1,
    });
    for (const bad of ["abc", "0", "1001", "-5", "2.5", "", " 10x"]) {
      expect(
        buildBotVisit(g(), "page", { BOT_VISIT_SAMPLE_RATE: bad }, () => 0.05),
      ).toMatchObject({ sample: 10 });
    }
  });

  it("drops the query and caps path and ua at 200 chars", () => {
    const longPath = "/ja/" + "a".repeat(400);
    const longUa = "GPTBot/1.2 " + "x".repeat(400);
    const v = buildBotVisit(req(`${longPath}?secret=1`, { ua: longUa }), "page", NO_ENV);
    expect(v?.path).toBe(longPath.slice(0, 200));
    expect(v?.path.startsWith("/")).toBe(true);
    expect(v?.ua).toBe(longUa.slice(0, 200));
    const q = buildBotVisit(req("/ja/articles/x?utm=1"), "page", NO_ENV);
    expect(q?.path).toBe("/ja/articles/x");
  });

  it("passes the kind through", () => {
    expect(buildBotVisit(req("/robots.txt"), "file", NO_ENV)?.kind).toBe("file");
    expect(buildBotVisit(req("/"), "redirect", NO_ENV)?.kind).toBe("redirect");
  });
});

describe("sendBotVisit", () => {
  const visit: BotVisit = {
    site: "livemakers",
    bot: "GPTBot",
    category: "training",
    kind: "page",
    sample: 1,
    path: "/ja",
    ua: GPTBOT_UA,
  };
  const TOKEN = "test-token-value-123";
  const ENV = {
    BOT_VISIT_INGEST_URL: "https://ingest.example.test/internal/bot-visits",
    BOT_VISIT_INGEST_TOKEN: TOKEN,
  };

  it("does nothing when disabled or not configured", async () => {
    for (const env of [
      { ...ENV, BOT_VISIT_INGEST_ENABLED: "0" },
      { BOT_VISIT_INGEST_TOKEN: TOKEN },
      { BOT_VISIT_INGEST_URL: ENV.BOT_VISIT_INGEST_URL },
      {},
    ]) {
      const f = vi.fn();
      await sendBotVisit(visit, env, f as unknown as typeof fetch);
      expect(f).not.toHaveBeenCalled();
    }
  });

  it("POSTs the visit with the token only in the Authorization header and a 2s timeout", async () => {
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    await sendBotVisit(visit, ENV, f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENV.BOT_VISIT_INGEST_URL);
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.get("content-type")).toBe("application/json");
    expect(typeof init.body).toBe("string");
    expect(init.body as string).not.toContain(TOKEN);
    expect(JSON.parse(init.body as string)).toEqual(visit);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("never rejects when fetch throws or the receiver fails", async () => {
    const throwing = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(
      sendBotVisit(visit, ENV, throwing as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    const failing = vi.fn(async () => new Response("boom", { status: 500 }));
    await expect(
      sendBotVisit(visit, ENV, failing as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    const syncThrow = vi.fn(() => {
      throw new Error("sync");
    });
    await expect(
      sendBotVisit(visit, ENV, syncThrow as unknown as typeof fetch),
    ).resolves.toBeUndefined();
  });

  it("does not log anything (the token must never reach logs)", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const throwing = vi.fn(async () => {
      throw new Error(`failed with ${TOKEN}`);
    });
    await sendBotVisit(visit, ENV, throwing as unknown as typeof fetch);
    for (const s of spies) {
      expect(s).not.toHaveBeenCalled();
      s.mockRestore();
    }
  });
});
