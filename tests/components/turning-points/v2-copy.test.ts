import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";

import ja from "@/messages/ja.json";
import en from "@/messages/en.json";
import { chipParts, headlineParts, overviewParts, shockParts, type Part, type RegimeOne } from "@/lib/pivots/regime";

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
const say = (t: ReturnType<typeof tr>, parts: Part[]) => parts.map((p) => t(p.key, p.values)).join("");

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
      "ここ 1〜3 か月は暴落です。ここ数日、ふだんの何倍もの下げがありました（1 日目）。",
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
      "下げ相場の底から戻している途中（上げ相場と呼ぶにはまだ早い）。6 月の底から 5 割戻しましたが、まだ 100 週線（約 2 年の平均・2,708 ドル）より下",
    );
  });
  it("BTC chips: long down note with the ATH date (year without a thousands separator), mid and near", () => {
    const c = chipParts(make({}));
    expect(t(c.long!.note.key, c.long!.note.values)).toBe("最高値 124,659 ドル（2025 年 10 月 6 日）から −45%。2 月 1 日から");
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
      "BTC は大きな流れで下げ相場。ETH は下げ相場からの戻りの途中。この 30 日はどちらも下げています。",
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
