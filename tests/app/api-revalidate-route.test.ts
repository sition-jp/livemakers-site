import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  after: vi.fn(),
  v2Enabled: true,
  fetchArticleRecord: vi.fn(async () => ({ kind: "missing" as const })),
}));

vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/articles/article-inflow-v2", () => ({
  articleRecordTag: (slug: string) => `lvm-article-record:${slug}`,
  fetchArticleRecord: mocks.fetchArticleRecord,
  isArticleInflowV2Enabled: () => mocks.v2Enabled,
}));

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
