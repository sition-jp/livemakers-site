import fs from "node:fs";

import { describe, expect, it } from "vitest";

const src = fs.readFileSync("app/[locale]/sessions/[slug]/page.tsx", "utf8");

describe("session detail page", () => {
  it("wires intraday day nav via getDaySessionNav", () => {
    expect(src).toContain("getDaySessionNav");
    expect(src).toContain("nav.prev");
    expect(src).toContain("nav.next");
  });

  // 2026-11-05 田平氏 GO: 記事詳細・動画の記事と同じ右レールを置く
  it("renders the shared article side rail with the article-detail grid", () => {
    expect(src).toContain("<SeriesRail");
    expect(src).toContain("current={null}");
    expect(src).toContain("loadRailContext");
    expect(src).toContain("lg:grid-cols-[minmax(0,1fr)_360px]");
  });
});
