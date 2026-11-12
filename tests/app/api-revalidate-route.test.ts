import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  after: vi.fn(),
  v2Enabled: true,
  fetchArticleRecord: vi.fn(async () => ({ kind: "missing" as const })),
  notifyIndexNow: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/articles/article-inflow-v2", () => ({
  articleRecordTag: (slug: string) => `lvm-article-record:${slug}`,
  fetchArticleRecord: mocks.fetchArticleRecord,
  isArticleInflowV2Enabled: () => mocks.v2Enabled,
}));

vi.mock("@/lib/seo/indexnow", () => ({ notifyIndexNowAfterResponse: mocks.notifyIndexNow }));

import { POST } from "@/app/api/revalidate/route";

const TOKEN = "test-token";
const SLUG = "a-20261027-0123abcd";

function request(paths: string[]) {
  return new Request("https://livemakers.com/api/revalidate", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ paths }),
  });
}

const originalToken = process.env.LIVEMAKERS_REVALIDATE_TOKEN;

afterEach(() => {
  if (originalToken === undefined) delete process.env.LIVEMAKERS_REVALIDATE_TOKEN;
  else process.env.LIVEMAKERS_REVALIDATE_TOKEN = originalToken;
  mocks.revalidateTag.mockClear();
  mocks.after.mockClear();
  mocks.fetchArticleRecord.mockClear();
  mocks.notifyIndexNow.mockReset();
  mocks.v2Enabled = true;
});

describe("/api/revalidate and the v2 article records (段 2a)", () => {
  it("expires the record tag of each article path and warms it after the response", async () => {
    process.env.LIVEMAKERS_REVALIDATE_TOKEN = TOKEN;
    const response = await POST(request(["/ja", `/ja/articles/${SLUG}`, `/en/articles/${SLUG}`]));
    expect(response.status).toBe(200);
    const recordCalls = mocks.revalidateTag.mock.calls.filter(([tag]) => String(tag).startsWith("lvm-article-record:"));
    expect(recordCalls).toEqual([[`lvm-article-record:${SLUG}`, "max"]]);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    await mocks.after.mock.calls[0][0]();
    expect(mocks.fetchArticleRecord).toHaveBeenCalledWith(SLUG);
  });

  it("leaves records alone when v2 is not enabled", async () => {
    process.env.LIVEMAKERS_REVALIDATE_TOKEN = TOKEN;
    mocks.v2Enabled = false;
    await POST(request([`/ja/articles/${SLUG}`]));
    const recordCalls = mocks.revalidateTag.mock.calls.filter(([tag]) => String(tag).startsWith("lvm-article-record:"));
    expect(recordCalls).toEqual([]);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("does not warm anything when no article path is sent", async () => {
    process.env.LIVEMAKERS_REVALIDATE_TOKEN = TOKEN;
    await POST(request(["/ja", "/en/articles"]));
    expect(mocks.after).not.toHaveBeenCalled();
  });
});

describe("/api/revalidate and IndexNow (2026-11-10)", () => {
  it("hands the accepted paths to IndexNow, whether or not v2 is enabled", async () => {
    process.env.LIVEMAKERS_REVALIDATE_TOKEN = TOKEN;
    mocks.v2Enabled = false;
    const response = await POST(request(["/ja", `/ja/articles/${SLUG}`]));
    expect(response.status).toBe(200);
    expect(mocks.notifyIndexNow).toHaveBeenCalledTimes(1);
    expect(mocks.notifyIndexNow).toHaveBeenCalledWith(["/ja", `/ja/articles/${SLUG}`]);
  });

  it("does not notify IndexNow when the token is wrong", async () => {
    process.env.LIVEMAKERS_REVALIDATE_TOKEN = "another-token";
    const response = await POST(request([`/ja/articles/${SLUG}`]));
    expect(response.status).toBe(401);
    expect(mocks.notifyIndexNow).not.toHaveBeenCalled();
  });

  it("still answers 200 when scheduling the notification throws", async () => {
    process.env.LIVEMAKERS_REVALIDATE_TOKEN = TOKEN;
    mocks.notifyIndexNow.mockImplementation(() => {
      throw new Error("after() unavailable");
    });
    const response = await POST(request([`/ja/articles/${SLUG}`]));
    expect(response.status).toBe(200);
    // 段 1 (2026-11-12): 記事の合図は RSS・sitemap と一覧の種類も作り直す
    expect(await response.json()).toMatchObject({ ok: true, revalidated: [`/ja/articles/${SLUG}`] });
  });
});

// 段 1 (2026-11-12 入れ直し): 記事の合図で一覧の種類と RSS・sitemap も作り直す。
// どれも「前のページを保つ」送り方 (revalidateTag(…, "max")) で送る
describe("/api/revalidate and the listing routes (段 1)", () => {
  it("marks listing route types and feeds stale on an article signal", async () => {
    process.env.LIVEMAKERS_REVALIDATE_TOKEN = TOKEN;
    mocks.v2Enabled = false;
    const response = await POST(request(["/ja/articles", `/ja/articles/${SLUG}`]));
    expect(response.status).toBe(200);
    const calls = mocks.revalidateTag.mock.calls.map(([tag, profile]) => [String(tag), profile]);
    expect(calls).toContainEqual(["_N_T_/[locale]/page", "max"]);
    expect(calls).toContainEqual(["_N_T_/[locale]/articles/series/[series]/page", "max"]);
    expect(calls).toContainEqual(["_N_T_/sitemap-news.xml", "max"]);
    expect(calls).toContainEqual([`_N_T_/ja/articles/${SLUG}`, "max"]);
    // 記事詳細の種類は送らない (全記事が一斉に作り直しになる)
    expect(calls.map(([tag]) => tag)).not.toContain("_N_T_/[locale]/articles/[slug]/page");
    expect(calls.every(([, profile]) => profile === "max")).toBe(true);
    // IndexNow には送られてきた path だけ
    expect(mocks.notifyIndexNow).toHaveBeenCalledWith(["/ja/articles", `/ja/articles/${SLUG}`]);
  });

  it("does not touch listing routes for the market-feed push", async () => {
    process.env.LIVEMAKERS_REVALIDATE_TOKEN = TOKEN;
    await POST(request(["/ja", "/en"]));
    const tags = mocks.revalidateTag.mock.calls.map(([tag]) => String(tag));
    expect(tags).toEqual(["_N_T_/ja", "_N_T_/en"]);
  });
});
