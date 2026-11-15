import { describe, expect, it } from "vitest";

import { GET } from "@/app/llms.txt/route";
import { buildLlmsTxt } from "@/lib/llms-txt";

describe("GET /llms.txt", () => {
  it("returns 200 text/plain with a one-day cache", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(await res.text()).toBe(buildLlmsTxt());
  });
});

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt();

  it("starts with the site heading", () => {
    expect(text.startsWith("# LiveMakers")).toBe(true);
  });

  it("has the four required sections", () => {
    for (const h of [
      "## 主な面 / Sections",
      "## 更新 / Updates",
      "## 引用について / Citation",
      "## 運営 / Publisher",
    ]) {
      expect(text).toContain(h);
    }
  });

  it("only links to https://livemakers.com/", () => {
    const urls = text.match(/https?:\/\/[^\s)]+/g) ?? [];
    expect(urls.length).toBeGreaterThan(5);
    for (const u of urls) {
      expect(u.startsWith("https://livemakers.com/")).toBe(true);
    }
  });

  it("never mentions prices, payments or paid services", () => {
    for (const w of ["price", "料金", "USDC", "x402", "有料"]) {
      expect(text.toLowerCase()).not.toContain(w.toLowerCase());
    }
  });
});
