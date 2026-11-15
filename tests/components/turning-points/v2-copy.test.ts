import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";

import ja from "@/messages/ja.json";
import en from "@/messages/en.json";
import { legendItems, upDownRows, workedExample } from "@/lib/pivots/range-band";
import { chipParts, headlineParts, overviewParts, shockParts, type Part, type RegimeOne } from "@/lib/pivots/regime";
import type { RangeBand } from "@/lib/pivots/types";

// 禁止語 (T6 と同じ一覧)。turningPoints.v2 のすべての文字列と、直したガイドの文に当てる。
const BANNED = [/予測/, /上がる/, /下がる/, /反転幅/, /predict/i, /goes up/i, /goes down/i];

type Json = string | { [k: string]: Json };

function walkStrings(node: Json, path: string, out: { path: string; value: string }[] = []) {
  if (typeof node === "string") out.push({ path, value: node });
  else for (const [k, v] of Object.entries(node)) walkStrings(v, `${path}.${k}`, out);
  return out;
}
function keyPaths(node: Json, path = ""): string[] {
  if (typeof node === "string") return [path];
  return Object.entries(node).flatMap(([k, v]) => keyPaths(v, path ? `${path}.${k}` : k));
}

const v2 = { ja: ja.turningPoints.v2 as unknown as Json, en: en.turningPoints.v2 as unknown as Json };

describe("turningPoints.v2 copy: key sets and banned words", () => {
  it("ja and en have the same key set", () => {
    expect(keyPaths(v2.ja).sort()).toEqual(keyPaths(v2.en).sort());
  });
  it("the edited guide sentence has the same key in both", () => {
    expect(typeof ja.turningPoints.guide.forecast_what).toBe("string");
    expect(typeof en.turningPoints.guide.forecast_what).toBe("string");
  });
  for (const locale of ["ja", "en"] as const) {
    it(`${locale}: no banned word in any v2 string or the edited guide`, () => {
      const msgs = locale === "ja" ? ja : en;
      const all = [
        ...walkStrings(v2[locale], "turningPoints.v2"),
        { path: "turningPoints.guide.forecast_what", value: msgs.turningPoints.guide.forecast_what },
      ];
      expect(all.length).toBeGreaterThan(150);
      for (const { path, value } of all) {
        for (const re of BANNED) expect(re.test(value), `${path} = "${value}" matched ${re}`).toBe(false);
      }
    });
  }
  it("the guide no longer describes the removed 90-day / 'move a lot' items", () => {
    for (const msgs of [ja, en]) {
      const g = msgs.turningPoints.guide.forecast_what;
      expect(g).not.toMatch(/90|4 つ|four/i);
      expect(g).not.toMatch(/大きく動く/);
    }
  });
});

function tr(locale: "ja" | "en") {
  return createTranslator({
    locale,
    messages: (locale === "ja" ? ja : en) as never,
    namespace: "turningPoints.v2" as never,
    onError: (e) => {
      throw e;
    },
  }) as unknown as (key: string, values?: Record<string, string | number>) => string;
}
const say = (t: ReturnType<typeof tr>, parts: Part[], sep = "") => parts.map((p) => t(p.key, p.values)).join(sep);

type Long = NonNullable<RegimeOne["long"]>;
const longOf = (state: Long["state"], over: Partial<Long> = {}): Long => ({
  state,
  since_week: "2026-02-01",
  last_week: "2026-11-08",
  ath: { date: "2025-10-06", close: 124659, pct_from_ath: -45.2 },
  w100: 2708,
  trough: { week: "2026-06-07", close: 1500 },
  peak: null,
  line_to_down: null,
  line_to_leave_down: null,
  ...over,
});
const make = (over: Partial<RegimeOne>): RegimeOne => ({
  as_of: "2026-11-13",
  long: longOf("down"),
  mid: { state: "range", since: "2026-11-08", days: 6 },
  near: { state: "down", since: "2026-10-31", days: 14, ret_30d_pct: -16.4, close_30d_ago: 81682.01, close: 68314.01 },
  ...over,
});
const near = (state: "up" | "flat" | "down", pct: number) => ({
  state,
  since: "2026-10-31",
  days: 14,
  ret_30d_pct: pct,
  close_30d_ago: 81682.01,
  close: 68314.01,
});

describe("rendered sentences (ja)", () => {
  const t = tr("ja");
  const head = (long: Long["state"], n: ReturnType<typeof near>) =>
    say(t, headlineParts(make({ long: longOf(long), near: n }), "long"));

  it("the 7 headline combos of the long-layer report §5", () => {
    expect(head("down", near("down", -16.4))).toBe("大きな流れは下げ相場です。この 30 日も下げています（−16%）。");
    expect(head("down", near("up", 12.2))).toBe("大きな流れは下げ相場です。この 30 日は戻しています（+12%）。");
    expect(head("down", near("flat", 2.1))).toBe("大きな流れは下げ相場です。この 30 日は横ばいです（+2%）。");
    expect(head("up", near("up", 12.2))).toBe("大きな流れは上げ相場です。この 30 日も上げています（+12%）。");
    expect(head("up", near("down", -9.4))).toBe("大きな流れは上げ相場です。この 30 日は下げています（−9%）。");
    expect(head("up", near("flat", 1.2))).toBe("大きな流れは上げ相場です。この 30 日は横ばいです（+1%）。");
    expect(head("recovering", near("down", -19.8))).toBe("大きな流れは戻りの途中です。この 30 日は下げています（−20%）。");
  });

  it("no long layer: the 30-day sentence alone; a missing percent drops the parenthesis", () => {
    expect(say(t, headlineParts(make({ long: null }), "long"))).toBe("この 30 日は下げています（−16%）。");
    const noRet = make({ near: { state: "down", since: "2026-10-31", days: 14, close: 68314.01 } });
    expect(say(t, headlineParts(noRet, "long"))).toBe("大きな流れは下げ相場です。この 30 日も下げています。");
    expect(say(t, chipParts(noRet).near ? [chipParts(noRet).near!.note] : [])).toBe("今 68,314 ドル（14 日目）");
  });

  it("alternative headlines (§4.1.1): mid and near", () => {
    expect(say(t, headlineParts(make({}), "mid"))).toBe(
      "ここ 1〜3 か月はレンジ相場です。下げ相場の中で、向きのはっきりしない時期が 6 日目です。",
    );
    expect(
      say(t, headlineParts(make({ long: longOf("recovering"), mid: { state: "range", since: "2026-11-09", days: 5 } }), "mid")),
    ).toBe("ここ 1〜3 か月はレンジ相場です。戻りの途中で、向きのはっきりしない時期が 5 日目です。");
    expect(say(t, headlineParts(make({}), "near"))).toBe(
      "この 30 日は下げています（−16%）。30 日前の 81,682 ドルから、今は 68,314 ドルです。",
    );
    expect(say(t, headlineParts(make({ mid: { state: "crash", since: "2026-11-10", days: 1 } }), "mid"))).toBe(
      "ここ 1〜3 か月は暴落です。ここ数日、ふだんの何倍もの下げが出ています（1 日目）。",
    );
  });

  const shock = (kind: "crash" | "surge", long: Long["state"], n: number, lower: number, higher: number) =>
    make({
      long: longOf(long),
      mid: { state: kind, since: "2026-11-10", days: 1 },
      shock: { kind, long_state: long, n, new_extreme_30d: lower, higher_30d: higher, start_day: null },
    });
  const shockText = (r: RegimeOne) => t(shockParts(r)!.key, shockParts(r)!.values);

  it("BTC down x crash (6 / 5 / 4) and the 2026-06-02 example (5 / 4 / 4)", () => {
    expect(shockText(shock("crash", "down", 6, 5, 4))).toBe(
      "過去に下げ相場の中で暴落が出たのは 6 回だけですが（件数が少ない）、そのうち 30 日以内にもっと安い終値をつけたのが 5 回、30 日後に暴落の出た日より高かったのが 4 回でした。",
    );
    expect(shockText(shock("crash", "down", 5, 4, 4))).toBe(
      "過去に下げ相場の中で暴落が出たのは 5 回だけですが（件数が少ない）、そのうち 30 日以内にもっと安い終値をつけたのが 4 回、30 日後に暴落の出た日より高かったのも 4 回でした。",
    );
  });
  it("n >= 10, surge, and the 0-case sentences", () => {
    expect(shockText(shock("crash", "up", 23, 17, 16))).toBe(
      "過去に上げ相場の中で暴落が出た 23 回では、30 日以内にもっと安い終値をつけたのが 17 回、30 日後に暴落の出た日より高かったのが 16 回でした。",
    );
    expect(shockText(shock("surge", "down", 6, 6, 4))).toBe(
      "過去に下げ相場の中で急騰が出たのは 6 回だけですが（件数が少ない）、そのうち 30 日以内にもっと高い終値をつけたのが 6 回、30 日後も急騰の出た日より高かったのが 4 回でした。",
    );
    expect(shockText(shock("crash", "recovering", 0, 0, 0))).toBe(
      "戻りの途中で暴落が出たのは過去 0 回で（件数が少ない）、比べられる例がまだありません。",
    );
    expect(shockText(shock("surge", "up", 4, 3, 2))).toBe(
      "上げ相場の中で急騰が出たのは過去 4 回だけで（件数が少ない）、比べられる例がまだありません。",
    );
  });

  it("ETH recovering chips: the note has no long-state prefix", () => {
    const eth = make({ long: longOf("recovering"), mid: { state: "range", since: "2026-11-09", days: 5 } });
    const c = chipParts(eth);
    expect(t(c.mid!.note.key, c.mid!.note.values)).toBe("向きのはっきりしない時期（5 日目）");
    expect(t(c.long!.note.key, c.long!.note.values)).toBe(
      "下げ相場の底から戻している途中（上げ相場と呼ぶにはまだ早い）。6 月の底から 5 割戻しましたが、まだ 100 週線（約 2 年の平均・2,708 ドル）より下。最高値 124,659 ドルから −45%。2 月 2 日から",
    );
  });
  it("BTC chips: long down note with the ATH date (year without a thousands separator), mid and near", () => {
    const c = chipParts(make({}));
    expect(t(c.long!.note.key, c.long!.note.values)).toBe("最高値 124,659 ドル（2025 年 10 月 6 日）から −45%。2 月 2 日から");
    expect(t(c.mid!.note.key, c.mid!.note.values)).toBe("下げ相場の中で、向きのはっきりしない時期（6 日目）");
    expect(t(c.near!.value.key, c.near!.value.values)).toBe("下げています −16%");
    expect(t(c.near!.note.key, c.near!.note.values)).toBe("30 日前 81,682 ドル → 今 68,314 ドル（14 日目）");
  });

  it("overview lines", () => {
    const btc = make({});
    const eth = make({ long: longOf("recovering"), near: near("down", -20) });
    expect(say(t, overviewParts({ BTC: btc, ETH: make({ near: near("down", -20) }) }))).toBe(
      "BTC も ETH も、いまは下げ相場。この 30 日はどちらも下げています。",
    );
    expect(say(t, overviewParts({ BTC: btc, ETH: eth }))).toBe(
      "BTC は大きな流れで下げ相場、ETH は下げ相場からの戻りの途中。この 30 日はどちらも下げています。",
    );
  });
});

describe("every key the pure functions can produce exists in ja and en", () => {
  const longs: (Long | null)[] = [null, longOf("down"), longOf("up"), longOf("recovering"), longOf("recovering", { trough: null }),
    longOf("down", { ath: { date: "2025-10-06", close: 124659, pct_from_ath: 1.5 } })];
  const mids = [null, ...(["range", "calm", "up", "down", "crash", "surge"] as const).map((s) => ({ state: s, since: "2026-11-08", days: 3 }))];
  const nears = [null, near("up", 5), near("flat", 0.2), near("down", -7),
    { state: "up" as const, since: "2026-10-31", days: 2, close: 100 }];
  for (const locale of ["ja", "en"] as const) {
    it(`${locale}: all long x mid x near combinations render without a missing key or argument`, () => {
      const t = tr(locale);
      let count = 0;
      for (const long of longs)
        for (const mid of mids)
          for (const nr of nears) {
            const kind = mid && (mid.state === "crash" || mid.state === "surge") ? mid.state : null;
            const r = make({
              long,
              mid,
              near: nr,
              shock: kind
                ? { kind, long_state: long && long.state !== undefined ? long.state : "down", n: 7, new_extreme_30d: 5, higher_30d: 5, start_day: null }
                : undefined,
            });
            for (const layer of ["long", "mid", "near"] as const) {
              for (const p of headlineParts(r, layer)) t(p.key, p.values), count++;
            }
            const c = chipParts(r);
            for (const chip of [c.long, c.mid, c.near]) if (chip) for (const p of [chip.label, chip.value, chip.note]) t(p.key, p.values), count++;
            const s = shockParts(r);
            if (s) t(s.key, s.values), count++;
          }
      expect(count).toBeGreaterThan(500);
    });
  }
  it("en sentences avoid direction words", () => {
    const t = tr("en");
    const r = make({ near: near("up", 12) });
    const text = [say(t, headlineParts(r, "long")), say(t, headlineParts(r, "mid")), say(t, headlineParts(r, "near"))].join(" ");
    expect(text).not.toMatch(/\b(rise|rises|fall|falls)\b/i);
  });
});

describe("mid-chip cells of the long-layer report §5 (ja)", () => {
  const t = tr("ja");
  const mid = (long: Long["state"] | null, state: "range" | "calm" | "up" | "down" | "crash" | "surge") => {
    const c = chipParts(make({ long: long ? longOf(long) : null, mid: { state, since: "2026-11-08", days: 6 } })).mid!;
    return t(c.note.key, c.note.values);
  };
  it("long up x 4 states", () => {
    expect(mid("up", "range")).toBe("上げ相場の中で、向きのはっきりしない時期（6 日目）");
    expect(mid("up", "calm")).toBe("上げ相場の中で、値動きが小さい時期（6 日目）");
    expect(mid("up", "up")).toBe("上げ相場の中の上げ（6 日目）");
    expect(mid("up", "down")).toBe("上げ相場の中の下げ（6 日目）");
  });
  it("long down x calm / up / down and crash / surge", () => {
    expect(mid("down", "calm")).toBe("下げ相場の中で、値動きが小さい時期（6 日目）");
    expect(mid("down", "up")).toBe("下げ相場の中の戻り（6 日目）");
    expect(mid("down", "down")).toBe("下げ相場の中の下げ（6 日目）");
    expect(mid("down", "crash")).toBe("ここ数日、ふだんの何倍もの下げ（6 日目）");
    expect(mid("up", "surge")).toBe("ここ数日、ふだんの何倍もの上げ（6 日目）");
  });
  it("recovering / no long use the unprefixed forms", () => {
    expect(mid("recovering", "calm")).toBe("値動きが小さい時期（6 日目）");
    expect(mid(null, "up")).toBe("上げが続いている時期（6 日目）");
    expect(mid("recovering", "down")).toBe("下げが続いている時期（6 日目）");
  });
});

describe("one rendered English check per family", () => {
  const t = tr("en");
  it("headline, chips, shock, overview", () => {
    const r = make({ near: near("down", -16.4) });
    expect(say(t, headlineParts(r, "long"), " ")).toBe("The big picture is a bear market. The last 30 days have also been down (−16%).");
    expect(say(t, headlineParts(r, "mid"), " ")).toBe(
      "The past 1–3 months: a range-bound market. Within a bear market, a stretch with no clear direction (day 6).",
    );
    const eth = make({ long: longOf("recovering") });
    const c = chipParts(eth);
    expect(t(c.mid!.note.key, c.mid!.note.values)).toBe("A stretch with no clear direction (day 6)");
    expect(t(c.long!.note.key, c.long!.note.values)).toBe(
      "Recovering from the bear market low (too early to call it a bull market). Up 50% from the June low, but still below the 100-week average (about 2 years, 2,708 dollars). −45% from the high of 124,659 dollars. Since Feb 2",
    );
    expect(t(chipParts(r).long!.note.key, chipParts(r).long!.note.values)).toBe(
      "−45% from the high of 124,659 dollars (Oct 6, 2025). Since Feb 2",
    );
    const sh = shockParts(make({
      mid: { state: "crash", since: "2026-11-10", days: 1 },
      shock: { kind: "crash", long_state: "down", n: 6, new_extreme_30d: 5, higher_30d: 4, start_day: null },
    }))!;
    expect(t(sh.key, sh.values)).toBe(
      "Only 6 crashes have happened during a bear market (a small sample). Of those, a lower close came within 30 days 5 times, and 4 times the close 30 days later was higher than on the crash day.",
    );
    expect(say(t, headlineParts(make({ mid: { state: "crash", since: "2026-11-10", days: 1 } }), "mid"), " ")).toBe(
      "The past 1–3 months: a crash. In the last few days there has been a drop several times larger than usual (day 1).",
    );
    expect(say(t, overviewParts({ BTC: make({}), ETH: eth }), " ")).toBe(
      "For BTC the big picture is a bear market; ETH is in a recovery in progress after a bear market. Both have been down over the last 30 days.",
    );
  });
});

describe("pre-formatted numbers render as the prototype shows them", () => {
  const t = tr("ja");
  const band: NonNullable<RangeBand[keyof RangeBand]> = {
    as_of: "2026-11-13",
    close: 68314.01,
    realized_vol_30d: 0.382,
    items: [
      { id: "either7", side: "both", horizon_days: 7, k: 1.25, threshold: 0.07, lo: 63767.4321, hi: 72861.5, usual_pct: 26.87 },
      { id: "either30", side: "both", horizon_days: 30, k: 1.5, threshold: 0.165, lo: 57019, hi: 79609, usual_pct: 27 },
      { id: "up30", side: "up", horizon_days: 30, k: 1, threshold: 0.11, hi: 75830, usual_pct: 18 },
    ],
    threshold_7d_365: { min: 0.046, max: 0.09, position: "mid" },
    source: { question_set: "q", version: "v", usual_period: "x" },
  };
  it("legend, up/down row, worked example", () => {
    const l = legendItems(band)[0];
    expect(t("band.legendItem", { ...l })).toBe("7 日の幅 63,767〜72,862 ドル（±7.0%）");
    expect(t("band.legendExit", { ...l })).toBe("この 7 日のうちに終値が外へ出る：27%（10 回に 3 回くらい）");
    const u = upDownRows(band)[0];
    expect(t("updown.cellUp", { ...u })).toBe("+11.0%（75,830）");
    expect(t("updown.rowDays", { ...u })).toBe("30 日");
    const w = workedExample(band, "BTC", "2026-11-13");
    expect(t("workedExample.s1", { ...w })).toBe("11 月 13 日の BTC の終値は 68,314 ドル。");
    expect(t("workedExample.s2", { ...w })).toBe("この 30 日の値動きの荒さは、1 日あたり約 2.0%（1 年あたりに直すと 38%）。");
    expect(t("workedExample.s3", { ...w })).toBe("7 日の幅 = 2.0% × √7（約 2.6）× 1.25 ≒ 7.0%。だから 63,767〜72,862 ドル。");
    expect(t("workedExample.s5", { ...w })).toBe("直近 1 年の BTC の 7 日の幅は ±4.6〜9.0% のあいだで動いてきました。いまの ±7.0% は、その真ん中あたりです。");
    expect(t("workedExample.closing", { ...w })).toBe(
      "つまり「この先 7 日のどこかで、終値が 63,767 ドルを下回るか 72,862 ドルを上回る」ことは、ふだんなら 10 回に 3 回くらい起きる、ということです。残りの 7 回は幅の中で終わります。",
    );
  });
  it("prototype small-card variants", () => {
    expect(t("turnCards.nowNoTurnTop", { month: 9, day: 21, price: "86,620", days: 53 })).toBe(
      "9 月 21 日の山（86,620 ドル）から、5% 戻す日がないまま 53 日下げています。",
    );
    expect(t("turnCards.nowNoTurnBottom", { month: 9, day: 21, price: "60,000", days: 8 })).toBe(
      "9 月 21 日の谷（60,000 ドル）から、5% 下げる日がないまま 8 日上げています。",
    );
    expect(tr("en")("turnCards.nowNoTurnTop", { month: 9, day: 21, price: "86,620", days: 53 })).toBe(
      "Since the peak of 86,620 dollars on Sep 21, there has been no 5% rebound in 53 days of declines.",
    );
  });
  it("en updated line says JST", () => {
    expect(tr("en")("updated.line", { month: 11, day: 14, closeMonth: 11, closeDay: 13 })).toContain("8:00 JST");
  });
});
