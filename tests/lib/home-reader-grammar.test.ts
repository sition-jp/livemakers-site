import { describe, expect, it } from "vitest";

import {
  findForbiddenDesignTerms,
  findForbiddenOpsTerms,
  findLiveTokenViolations,
  findRawInstrumentIdViolations,
} from "@/lib/home/reader-grammar";

describe("reader grammar guards (D8/D9)", () => {
  it("flags design vocabulary but allows approved public labels", () => {
    expect(findForbiddenDesignTerms("CO-EQUALな構成")).toEqual(["CO-EQUAL"]);
    expect(findForbiddenDesignTerms("対1のライブ面")).toEqual([
      "ライブ面",
      "対1",
    ]);
    expect(findForbiddenDesignTerms("SDE検出のタイトルです")).toEqual([]);
    expect(findForbiddenDesignTerms("いまを見る ⇄ 今日を読む")).toEqual([]);
  });

  it("flags internal ops terms in rendered copy", () => {
    expect(findForbiddenOpsTerms("Phase 1 のクロールで検出")).not.toEqual([]);
    expect(findForbiddenOpsTerms("crawler が拾った話題")).not.toEqual([]);
    expect(findForbiddenOpsTerms("一次ソース検証を経た記事")).toEqual([]);
    expect(findForbiddenOpsTerms("scrawled notes")).toEqual([]);
  });

  it("bans the standalone LIVE token only", () => {
    expect(findLiveTokenViolations("LIVE 更新中")).toEqual(["LIVE"]);
    expect(findLiveTokenViolations("LIVEMAKERS 先行指標")).toEqual([]);
    expect(
      findLiveTokenViolations("ライブは時間が経つと記事になります"),
    ).toEqual([]);
    expect(findLiveTokenViolations("DELIVERED")).toEqual([]);
  });

  it("flags raw instrument ids in reader-facing labels", () => {
    expect(
      findRawInstrumentIdViolations("nikkei_futures / usd_jpy / BTC/USD"),
    ).toEqual(["nikkei_futures", "usd_jpy"]);
    expect(
      findRawInstrumentIdViolations("日経平均先物 / USD/JPY / BTC/USD"),
    ).toEqual([]);
  });
});
