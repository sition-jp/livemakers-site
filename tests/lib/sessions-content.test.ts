import { describe, expect, it } from "vitest";

import {
  editorialUrlOrHandleMatches,
  formatSessionTimestamp,
  findSessionRecord,
  getAllSessionRecords,
  getSessionRecord,
  normalizeFocusInstruments,
  parseSessionMeta,
  sessionEditorialTextViolations,
} from "@/lib/sessions/session-content";

describe("formatSessionTimestamp", () => {
  // 生 ISO (2026-08-08T23:44:59+09:00) をそのまま読者に見せない。
  // schema (JST_ISO) が +09:00 を強制するので、表示は常に JST。
  it("renders a JST label without the ISO offset or seconds", () => {
    expect(formatSessionTimestamp("2026-08-08T23:44:59+09:00")).toBe(
      "2026-08-08 23:44 JST",
    );
  });

  it("accepts the seconds-less form the schema also allows", () => {
    expect(formatSessionTimestamp("2026-08-07T05:03+09:00")).toBe(
      "2026-08-07 05:03 JST",
    );
  });

  it("returns null for a missing timestamp", () => {
    expect(formatSessionTimestamp(null)).toBeNull();
  });

  it("passes through anything that is not the expected JST shape", () => {
    // 想定外の形を勝手に整形して誤表示するより、原文を出して気づけるようにする
    expect(formatSessionTimestamp("2026-08-08T23:44:59Z")).toBe(
      "2026-08-08T23:44:59Z",
    );
  });
});

describe("session content lifecycle (G-a)", () => {
  it("returns null only for a genuinely missing session", () => {
    expect(findSessionRecord("2099-01-01-asia-open")).toBeNull();
  });

  it("loads the live fixture session with lifecycle fields", () => {
    const record = getSessionRecord("2026-07-10-asia-open");
    expect(record.sessionId).toBe("2026-07-10-asia-open");
    expect(record.sessionSlug).toBe("asia-open");
    expect(record.liveStatus).toBe("live");
    expect(record.articleStatus).toBe("pending");
    expect(record.currentUrl).toBe("/sessions/2026-07-10-asia-open");
    expect(record.canonicalArticleUrl).toBeNull();
    expect(record.publishedAt).toBeNull();
    expect(record.publishLogId).toBeNull();
    expect(record.packetId).toBe("sess_20260710_asia");
    expect(record.focusInstruments).toEqual([
      "nikkei_futures",
      "usd_jpy",
      "btc_usd",
    ]);
    expect(record.focusFallbackApplied).toBe(false);
    expect(record.bullets.length).toBeGreaterThanOrEqual(2);
    // fix round 2 / I-2: a repo read always materializes a route (this record
    // lives in content/sessions/, so generateStaticParams produces its page).
    expect(record.hasMaterializedRoute).toBe(true);
  });

  it("normalizes invalid focus declarations to registry defaults", () => {
    expect(normalizeFocusInstruments(["nikkei_futures"], "asia-open")).toEqual(
      {
        instruments: ["nikkei_futures", "usd_jpy"],
        fallbackApplied: true,
      },
    );
    expect(
      normalizeFocusInstruments(
        ["nikkei_futures", "usd_jpy", "not_a_real_id"],
        "asia-open",
      ),
    ).toEqual({
      instruments: ["nikkei_futures", "usd_jpy"],
      fallbackApplied: false,
    });
    expect(
      normalizeFocusInstruments(
        ["nikkei_futures", "nikkei_futures"],
        "asia-open",
      ),
    ).toEqual({
      instruments: ["nikkei_futures", "usd_jpy"],
      fallbackApplied: true,
    });
  });

  it("rejects illegal lifecycle combinations", () => {
    expect(() =>
      parseSessionMeta({
        sessionId: "2026-07-09-ny-open",
        sessionSlug: "ny-open",
        date: "2026-07-09",
        liveStatus: "live",
        articleStatus: "published",
        currentUrl: "/sessions/2026-07-09-ny-open",
        canonicalArticleUrl: "/sessions/2026-07-09-ny-open",
        publishedAt: "2026-07-09T18:40:00+09:00",
        publishLogId: null,
        packetId: "sess_20260709_ny",
        asOfJst: "2026-07-09T18:40:00+09:00",
        focusInstruments: ["spx", "us10y"],
        titleJa: "x",
        bullets: ["a"],
      }),
    ).toThrow(/published session must have liveStatus=closed/);
  });

  it("crystallizes past sessions at the same URL", () => {
    const record = getSessionRecord("2026-08-07-global-close");
    expect(record.liveStatus).toBe("closed");
    expect(record.articleStatus).toBe("published");
    expect(record.canonicalArticleUrl).toBe(record.currentUrl);
    // publishedAt = crystallize 実行時刻 (セッション当日ではない)
    expect(record.publishedAt).toMatch(/^2026-08-08T/);
    expect(record.bodyJa).toContain("数値スナップショット");
  });

  it("rejects a published session whose canonical URL differs", () => {
    expect(() =>
      parseSessionMeta({
        sessionId: "2026-07-09-ny-open",
        sessionSlug: "ny-open",
        date: "2026-07-09",
        liveStatus: "closed",
        articleStatus: "published",
        currentUrl: "/sessions/2026-07-09-ny-open",
        canonicalArticleUrl: "/articles/wrong-place",
        publishedAt: "2026-07-09T18:40:00+09:00",
        publishLogId: null,
        packetId: "sess_20260709_ny",
        asOfJst: "2026-07-09T18:40:00+09:00",
        focusInstruments: ["spx", "us10y"],
        titleJa: "x",
        bullets: ["a", "b"],
      }),
    ).toThrow(/canonicalArticleUrl must equal currentUrl/);
  });

  it("orders the archive newest-first and excludes non-published sessions", () => {
    const published = getAllSessionRecords().filter(
      (record) => record.articleStatus === "published",
    );
    expect(published.map((record) => record.sessionId)).toEqual([
      "2026-08-07-global-close",
      "2026-08-07-ny-open",
      "2026-08-07-asia-open",
    ]);
  });
});

// PR #61 Fable5 レビュー P2-2。純度違反 1 件で sessions bundle 全体が null に
// 落ちるので、誤爆の可用性コストが大きい。以下 2 つのコーパスは producer 側
// (sition-discovery-engine `livemakers_export/tests/test_session_digest_reader.py`
// の同名ブロック) と対で維持する — 片側だけ緩めると producer が通した本文を
// site が落とす。
describe("editorial purity regex calibration", () => {
  it.each([
    // 「必ずしも」は断定ではなく打ち消し
    "政策変更は必ずしも即時の資金流入を意味しない。",
    "必ずしも連動しない指標の乖離を確認する。",
    // 「私◯」は一人称ではなく private の複合語
    "私募債の発行枠が拡大したと公表された。",
    "私的整理の手続きに入ったと明らかにされた。",
    "私立大学の基金が運用方針を見直した。",
    "私有地の再開発計画が承認された。",
    // 「不確実(性)」は確信の反対語
    "不確実性が高まったとの認識が示された。",
    // 「絶対値」「絶対収益」は金融の技術用語
    "絶対収益型の資金流入が続いた。",
    "絶対値での乖離幅を確認する。",
  ])("clears calibrated vocabulary: %s", (text) => {
    expect(sessionEditorialTextViolations(text)).toEqual([]);
  });

  it.each([
    // 除外集合に入れてはいけない一人称 — 自 / 共 / 見
    ["私自身が現場で確認した。", "first_person"],
    ["私共は現場で確認した。", "first_person"],
    ["私見では上昇が続く。", "first_person"],
    ["私が確認する。", "first_person"],
    // 打ち消し・複合語を伴わない断定は従来どおり RED
    ["市場は必ず上がる。", "unsupported_certainty"],
    ["価格は絶対に上昇する。", "unsupported_certainty"],
    ["確実性の高い展開になる。", "unsupported_certainty"],
  ])("still flags a true violation: %s", (text, expected) => {
    expect(sessionEditorialTextViolations(text)).toContain(expected);
  });
});

// P2-5: URL/handle パターンは session-content 側の 1 実装だけを正本にし、
// live-market-feed.ts はこの関数を import する (以前は両者が同型の regex を
// 二重定義していた)。
describe("editorialUrlOrHandleMatches", () => {
  it("returns every URL and handle it found", () => {
    expect(
      editorialUrlOrHandleMatches("example.org/news と @official を確認した。"),
    ).toEqual(["example.org/news", "@official"]);
  });

  it("returns nothing for clean editorial prose", () => {
    expect(
      editorialUrlOrHandleMatches("公式発表では次の判断材料が示された。"),
    ).toEqual([]);
  });

  it("is not stateful across calls", () => {
    const text = "https://example.org/a を確認した。";
    expect(editorialUrlOrHandleMatches(text)).toEqual(
      editorialUrlOrHandleMatches(text),
    );
  });
});
