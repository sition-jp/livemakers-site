import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TERMINAL_FEED_CACHE_TAG,
  TERMINAL_FEED_ENV_KEY,
  fetchLiveMarketData,
} from "@/lib/terminal/live-market-feed";

// 2026-10-26 段 1 (設計書 08_DOCS/knowledge/specs/2026-10-26-lvm-lmk-vercel-cost-on-demand-and-catalog-split-design.md):
// 時間での作り直しは保険に下げ、記事の公開・セッション時刻・0 時の合図で作り直す。
// 時間の短縮へ戻すと ISR 書き込みと CPU が読者数と無関係に増える (コストの穴)。
const SIX_HOURS = [
  "app/[locale]/page.tsx",
  "app/[locale]/about/page.tsx",
  "app/[locale]/articles/series/[series]/page.tsx",
  "app/[locale]/articles/series/[series]/page/[page]/page.tsx",
  "app/[locale]/articles/today/page.tsx",
  "app/[locale]/future-atlas/page.tsx",
  "app/[locale]/future-atlas/ledger/page.tsx",
  "app/[locale]/future-atlas/methodology/page.tsx",
  "app/[locale]/sessions/archive/page.tsx",
  "app/[locale]/sessions/archive/past/page.tsx",
  "app/sitemap-news.xml/route.ts",
];
const ONE_DAY = [
  "app/[locale]/articles/[slug]/page.tsx",
  "app/ja/feed.xml/route.ts",
  "app/ja/feed/route.ts",
  "app/sitemap.ts",
];

function listSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSources(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

afterEach(() => {
  delete process.env[TERMINAL_FEED_ENV_KEY];
  vi.unstubAllGlobals();
});

describe("ISR intervals (2026-10-26 段 1)", () => {
  it.each(SIX_HOURS)("re-renders %s by time only every 6 hours", (file) => {
    expect(fs.readFileSync(file, "utf8")).toContain("export const revalidate = 21600;");
  });

  it.each(ONE_DAY)("re-renders %s by time only once a day", (file) => {
    expect(fs.readFileSync(file, "utf8")).toContain("export const revalidate = 86400;");
  });

  it("keeps no page on the old 5-minute / 1-hour timers", () => {
    const offenders = listSources("app").filter((file) =>
      /export const revalidate = (300|3600);/.test(fs.readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("schedules the 00:00 JST refresh next to the session-anchor crons", () => {
    const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const schedules = vercel.crons
      .filter((cron) => cron.path === "/api/cron/refresh-home")
      .map((cron) => cron.schedule);
    expect(schedules).toEqual([
      "12 20 * * *",
      "50 22 * * *",
      "12 3 * * *",
      "12 9 * * *",
      "12 14 * * *",
      "0 15 * * *",
    ]);
  });

  it("tags the market-feed fetch so the cron can refresh every page's ticker", async () => {
    process.env[TERMINAL_FEED_ENV_KEY] = "https://example.test/terminal_feed.public.json";
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({ ok: false, status: 503 }) as Response,
    );
    vi.stubGlobal("fetch", fetcher);
    await fetchLiveMarketData();
    const init = fetcher.mock.calls[0]?.[1] as RequestInit & {
      next?: { tags?: string[] };
    };
    expect(init.next?.tags).toEqual([TERMINAL_FEED_CACHE_TAG]);
  });
});
