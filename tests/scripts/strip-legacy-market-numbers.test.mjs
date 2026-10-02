// tests/scripts/strip-legacy-market-numbers.test.mjs
import { describe, expect, it } from "vitest";
import {
  LEGACY_NOTE,
  isLegacyNumberBullet,
  planSession,
  stripBody,
  stripMeta,
} from "../../scripts/sessions/strip-legacy-market-numbers.mjs";

const EDITORIAL_BODY = `この夜に並んだのは、資本と設備の位置が動いた話だ。

## 数値スナップショット

- Gold $4,361.80 → $4,451.20（+2.05%）
- 変動幅上位: NIGHT/USD -5.1% / ADA/USD -5.1%

| 指標 | 起点 | 現値 | 変化率 |
| --- | --- | --- | --- |
| Gold | $4,361.80 | $4,451.20 | +2.05% |

## 一次情報ハイライト

- [見出し](https://x.com/a/status/1) — 補足。
- [2 年債利回りは 3.55%（9 月 3 日時点）](https://fred.stlouisfed.org/series/DGS2)

## 次の見どころ

- 次に見るもの
`;

const NUMBERS_ONLY_BODY = `- S&P 500 7,670.84 → 7,651.54（-0.25%）
- 変動幅上位: NIGHT/USD +27.5% / VIX +3.5%

## 数値スナップショット

| 指標 | 起点 | 現値 | 変化率 |
| --- | --- | --- | --- |
| S&P 500 | 7,670.84 | 7,651.54 | -0.25% |
`;

describe("isLegacyNumberBullet", () => {
  it.each([
    "S&P 500 7,670.84 → 7,651.54（-0.25%）",
    "- Gold $4,361.80 → $4,451.20（+2.05%）",
    "日経平均先物 41,250 → 41,400（+0.36%）",
    "変動幅上位: VIX +3.5% / WTI -2.0%",
    "- 変動幅上位: NIGHT/USD +27.5% / VIX +3.5%",
  ])("detects %s", (text) => {
    expect(isLegacyNumberBullet(text)).toBe(true);
  });

  it.each([
    "BTCは63K台で続伸。アジア時間の現物フローは薄く、方向感は米時間持ち越し",
    "SEC が自前の提案を 12 月に出す → 市場構造法は 1 月へ",
    "- [見出し](https://x.com/a/status/1) — 補足。",
  ])("leaves %s", (text) => {
    expect(isLegacyNumberBullet(text)).toBe(false);
  });
});

describe("stripBody", () => {
  it("removes the snapshot section and keeps lead, highlights and watch", () => {
    const result = stripBody(EDITORIAL_BODY);
    expect(result.body).not.toContain("## 数値スナップショット");
    expect(result.body).not.toContain("$4,451.20");
    expect(result.body).not.toContain("変動幅上位");
    expect(result.body).toContain("この夜に並んだのは");
    expect(result.body).toContain("## 一次情報ハイライト");
    expect(result.body).toContain("## 次の見どころ");
    expect(result.body).toContain("fred.stlouisfed.org/series/DGS2");
    expect(result).toMatchObject({ removedSection: true, replacedWithNote: false });
  });

  it("replaces a numbers-only body with the note", () => {
    const result = stripBody(NUMBERS_ONLY_BODY);
    expect(result.body).toBe(`${LEGACY_NOTE}\n`);
    expect(result).toMatchObject({ removedSection: true, removedBullets: 2, replacedWithNote: true });
  });

  it("never leaves three or more consecutive blank lines", () => {
    expect(stripBody(EDITORIAL_BODY).body).not.toMatch(/\n{3,}/);
  });

  it("is idempotent", () => {
    const once = stripBody(EDITORIAL_BODY).body;
    expect(stripBody(once).body).toBe(once);
    const note = stripBody(NUMBERS_ONLY_BODY).body;
    expect(stripBody(note).body).toBe(note);
  });
});

describe("stripMeta", () => {
  const meta = {
    sessionId: "2026-09-04-global-close",
    bullets: ["Gold $4,361.80 → $4,451.20（+2.05%）", "変動幅上位: VIX +3.5% / WTI -2.0%"],
    editorial: {
      lead: "リード",
      items: [
        { headline: "見出し", sourceUrl: "https://x.com/a/status/1" },
        { headline: "2 年債利回りは 3.55%（9 月 3 日時点）", sourceUrl: "https://fred.stlouisfed.org/series/DGS2" },
      ],
      watch: ["次"],
    },
  };

  it("removes numeric bullets and keeps everything else", () => {
    const result = stripMeta(meta);
    expect(result.meta.bullets).toEqual([]);
    expect(result.meta.editorial.items).toHaveLength(2);
    expect(result.meta.sessionId).toBe(meta.sessionId);
    expect(result.removedBullets).toBe(2);
  });

  it("does not mutate its input", () => {
    stripMeta(meta);
    expect(meta.bullets).toHaveLength(2);
    expect(meta.editorial.items).toHaveLength(2);
  });
});

describe("planSession", () => {
  const cutoff = "2026-10-03T22:55:00+09:00";
  it("converts green sessions observed before the cutoff", () => {
    expect(planSession({ asOfJst: "2026-10-01T18:03:09+09:00" }, cutoff)).toBe("convert");
  });
  it("skips digest-only sessions", () => {
    expect(planSession({ asOfJst: "2026-10-01T18:03:09+09:00", observationStatus: "absent" }, cutoff)).toBe("skip_absent");
  });
  it("skips sessions at or after the cutoff (Hyperliquid era)", () => {
    expect(planSession({ asOfJst: "2026-10-03T23:03:05+09:00" }, cutoff)).toBe("skip_after_cutoff");
    expect(planSession({ asOfJst: cutoff }, cutoff)).toBe("skip_after_cutoff");
  });
});
