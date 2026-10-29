/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { LandmarkMeter, type LandmarkMeterTranslate } from "@/components/articles/LandmarkMeter";
import { mapLandmarkMeter, type LandmarkMeterData } from "@/lib/landmark/meter-feed";
import { buildLandmarkRows } from "@/lib/landmark/meter-model";
import {
  findForbiddenDesignTerms,
  findForbiddenOpsTerms,
  findLiveTokenViolations,
} from "@/lib/home/reader-grammar";
import ja from "@/messages/ja.json";
import section from "../../fixtures/landmark/section.json";
import section17 from "../../fixtures/landmark/section-2026-10-17.json";
import sectionEve from "../../fixtures/landmark/section-2026-10-17-evening.json";
import sectionSeries from "../../fixtures/landmark/section-2026-10-17-series.json";

const NOW = new Date("2026-10-16T10:45:00Z"); // 19:45 JST
const NOW17 = new Date("2026-10-17T01:45:00Z"); // 10:45 JST
const NOW_EVE = new Date("2026-10-17T10:45:00Z"); // 19:45 JST
const t = createTranslator({
  locale: "ja",
  messages: ja,
  namespace: "articles.landmarkMeter",
}) as unknown as LandmarkMeterTranslate;

function renderMeter(mutate?: (d: LandmarkMeterData) => void, fixture: unknown = section, now: Date = NOW) {
  const data = mapLandmarkMeter(structuredClone(fixture));
  if (!data) throw new Error("fixture must be valid");
  mutate?.(data);
  const rows = buildLandmarkRows(data, now);
  if (!rows) throw new Error("rows must exist");
  return render(<LandmarkMeter rows={rows} t={t} />);
}

describe("LandmarkMeter", () => {
  it("renders the 2026-10-16 section (six rows in the feed) in Japanese", () => {
    const { container } = renderMeter();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("節目の計器盤");
    const rows = container.querySelectorAll("[data-landmark-row]");
    expect([...rows].map((row) => row.getAttribute("data-landmark-row"))).toEqual([
      "ma200w", "macd2w", "macd1m", "mvrv", "funding", "etf", "ethEtf", "stableYoy", "stableAth",
    ]);
    // feed に無い 7〜9 行目は条件を残して値を「—」にする。月足は下抜けが無いので上抜けだけ
    const yoy = container.querySelector('[data-landmark-row="stableYoy"]')!;
    expect(yoy.textContent).toContain("365 日前と比べた増減の符号が変わる");
    expect(yoy.textContent).toContain("—（データ更新待ち）");
    const m1m = container.querySelector('[data-landmark-row="macd1m"]')!;
    expect(m1m.textContent).toContain("上抜け 2023年7月31日（5 回）");
    expect(m1m.textContent).not.toContain("下抜け");
    const text = container.textContent ?? "";
    expect(text).toContain("終値 83,637 ドル・200 週平均 66,506 ドル（10/11 の週）");
    expect(text).toContain("平均との差 +25.8%");
    expect(text).toContain("2027年8月22日の週から再び数える");
    expect(text).toContain("シグナルとの差 +2,352");
    expect(text).toContain("次の点灯は、一度シグナル線を下回ってから");
    expect(text).toContain("次の判定は 10/31 の確定足");
    expect(text).toContain("2026年10月3日に、上抜けをゼロ線の下に限る形から上下を問わない形へ変更");
    expect(text).toContain("回復は、割れた後に判定");
    expect(text).toContain("2026年11月19日から再び数える");
    expect(text).toContain("最高（2025年10月9日・627.4 億ドル）まで 50.7 億ドル");
    expect(text).toContain("上場（2024 年）以降 1 回");
    expect(text).toContain("2014 年以降 4 回");
    expect(text).toContain("点灯は指標ごとに過去 1〜5 回で");
    expect(text).toContain("TFTC (tftc.io/bitcoin-etf-flows) の公開データ・CC BY 4.0（BTC 現物 ETF）");
    // BTC の ETF の行は TFTC の値 (Farside の保存ページから切り替えた)。Farside は ETH の出典として注記にだけ出る
    expect(container.querySelector('[data-landmark-row="etf"]')!.textContent).not.toContain("Farside");
    const eth = container.querySelector('[data-landmark-row="ethEtf"]')!.textContent ?? "";
    expect(eth).toContain("累計が過去最高を更新する");
    expect(eth).toContain("—（データ更新待ち）");
    // fixture の ETF は値の日付が 14 日前なので日付を太字にする
    const etf = container.querySelector('[data-landmark-row="etf"]');
    expect(etf?.querySelector("strong")?.textContent).toBe("10/2 時点・TFTC 集計");
    expect(container.querySelector('[data-landmark-row="ma200w"] strong')).toBeNull();
  });

  it("keeps the condition and blanks the values of a row without fresh data", () => {
    const { container } = renderMeter((d) => {
      d.items = d.items.filter((item) => item.key !== "btc_etf_cum_high");
    });
    const etf = container.querySelector('[data-landmark-row="etf"]')!;
    expect(etf.textContent).toContain("累計が過去最高を更新する");
    expect(etf.textContent).toContain("—（データ更新待ち）");
    expect(etf.textContent).not.toContain("億ドル（");
  });

  it("shows the fired badge while the firing bar is the latest bar", () => {
    const { container } = renderMeter((d) => {
      d.items[1].lastEvent = d.items[1].barDate;
    });
    const row = container.querySelector('[data-landmark-row="macd2w"]')!;
    expect(row.textContent).toContain("点灯10/4 確定の足");
    expect(row.textContent).not.toContain("確定の足で点灯");
    expect(row.textContent).not.toContain("上抜け後");
  });

  it("uses only neutral badges and no color or progress visuals", () => {
    const { container } = renderMeter();
    const badges = [...container.querySelectorAll("[data-landmark-badge]")].map((b) => b.textContent);
    expect(badges).toEqual(["休止期間", "上抜け後", "前提待ち", "休止期間"]);
    expect(container.innerHTML).not.toMatch(/status-up|status-down|staleness-|<progress|role="meter"/);
  });
});

describe("LandmarkMeter — stablecoin rows and the monthly dead cross (2026-10-17)", () => {
  it("renders the eight rows of the 2026-10-17 section", () => {
    const { container } = renderMeter(undefined, section17, NOW17);
    const text = container.textContent ?? "";
    expect(text).toContain("節目シグナルの各指標が、いまどこにあるか");
    expect(text).not.toContain("6 つ");
    const yoy = container.querySelector('[data-landmark-row="stableYoy"]')!.textContent ?? "";
    expect(yoy).toContain("ステーブルコイン総供給");
    expect(yoy).toContain("前年比 +0.30%・総供給 3,052 億ドル（10/16・DefiLlama 集計）");
    expect(yoy).toContain("0% との差 +0.30%");
    expect(yoy).toContain("2024年2月11日（プラスへ）");
    expect(yoy).toContain("2022 年以降 2 回");
    expect(yoy).toContain("2026年10月17日に、判定の起点を 2021年1月1日に変更");
    const ath = container.querySelector('[data-landmark-row="stableAth"]')!.textContent ?? "";
    expect(ath).toContain("総供給 3,052 億ドル（10/16・DefiLlama 集計）");
    expect(ath).toContain("最高（2026年5月17日・3,155 億ドル）まで 103 億ドル");
    expect(ath).toContain("2024年11月22日");
    expect(ath).toContain("2021 年以降 1 回");
    expect(ath).toContain("2026年10月17日に、判定の起点を 2021年1月1日に変更");
    const m1m = container.querySelector('[data-landmark-row="macd1m"]')!.textContent ?? "";
    expect(m1m).toContain("下抜け: 月末の確定足で、MACD がシグナル線を上から下に抜ける");
    expect(m1m).toContain("次の判定は 10/31 の確定足");
    expect(m1m).toContain("下抜け後次の下抜けは、一度シグナル線を上回ってから");
    expect(m1m).toContain("上抜け 2023年7月31日（5 回）");
    expect(m1m).toContain("下抜け 2025年11月30日（6 回）");
    expect(m1m).toContain("2013 年以降");
    expect(text).toContain("点灯は指標ごとに過去 1〜6 回で");
    expect(text).toContain("ステーブルコインの前年比は 180 日、総供給の最高は 90 日");
    expect(text).toContain("DefiLlama（ステーブルコイン総供給・USD ペッグ・2021 年以降の値で判定）");
    const badges = [...container.querySelectorAll("[data-landmark-badge]")].map((b) => b.textContent);
    expect(badges).toEqual(["休止期間", "上抜け後", "下抜け後", "前提待ち", "休止期間"]);
  });

  it("shows the direction when the yoy sign flips", () => {
    const { container } = renderMeter((d) => {
      d.items[6].lastEvent = "2026-10-16";
      d.items[6].lastDirection = "negative";
      d.items[6].count = 3;
    }, section17, NOW17);
    const yoy = container.querySelector('[data-landmark-row="stableYoy"]')!.textContent ?? "";
    expect(yoy).toContain("点灯2026年10月16日にマイナスに転じた");
    expect(yoy).toContain("2026年10月16日（マイナスへ）");
  });

  it("says the current value is the high instead of a zero gap", () => {
    const { container } = renderMeter((d) => {
      d.items[7].values = { supply: "3,160", peak: "3,160", toPeak: "0", peakDate: "2026-10-16" };
      d.items[5].values = { ...d.items[5].values, peakDate: d.items[5].barDate, toPeak: "0.0" };
    }, section17, NOW17);
    const ath = container.querySelector('[data-landmark-row="stableAth"]')!.textContent ?? "";
    expect(ath).toContain("いまの値が最高（2026年10月16日）");
    expect(ath).not.toContain("まで 0 億ドル");
    const etf = container.querySelector('[data-landmark-row="etf"]')!.textContent ?? "";
    expect(etf).toContain("いまの値が最高（2026年10月14日）");
    expect(etf).not.toContain("まで 0.0 億ドル");
  });

  it("names the downward cross as the next judged one after an upward cross", () => {
    const { container } = renderMeter((d) => {
      d.items[2].state = "after_cross";
      d.items[2].values = { ...d.items[2].values, diff: "+1,200" };
      d.items[2].dead = { state: "armed", lastEvent: "2025-11-30", count: 6 };
    }, section17, NOW17);
    const m1m = container.querySelector('[data-landmark-row="macd1m"]')!.textContent ?? "";
    expect(m1m).toContain("上抜け後次の上抜けは、一度シグナル線を下回ってから");
    expect(m1m).toContain("次の下抜けの判定は 10/31 の確定足");
    expect(m1m).not.toContain("次の判定は 10/31");
  });

  it("shows 点灯なし for a yoy row that has never fired", () => {
    const { container } = renderMeter((d) => {
      d.items[6].lastEvent = null;
      d.items[6].lastDirection = null;
      d.items[6].count = 0;
    }, section17, NOW17);
    const yoy = container.querySelector('[data-landmark-row="stableYoy"]')!.textContent ?? "";
    expect(yoy).toContain("点灯なし");
    expect(yoy).toContain("2022 年以降 0 回");
    expect(yoy).not.toContain("プラスへ");
  });

  it("shows the fired dead cross on its bar", () => {
    const { container } = renderMeter((d) => {
      d.items[2].dead = { state: "after_cross", lastEvent: d.items[2].barDate, count: 7 };
    }, section17, NOW17);
    const m1m = container.querySelector('[data-landmark-row="macd1m"]')!.textContent ?? "";
    expect(m1m).toContain("点灯9/30 確定の足で下抜け");
    expect(m1m).not.toContain("下抜け後");
    expect(m1m).not.toContain("次の判定は");
  });
});

describe("landmark meter copy", () => {
  const copy = JSON.stringify(ja.articles.landmarkMeter);

  it("avoids hype, probability and imminence words (spec §6)", () => {
    for (const word of ["迫る", "目前", "接近", "間近", "しかけ", "急接近", "警戒", "確率", "勝", "敗"]) {
      expect(copy, word).not.toContain(word);
    }
  });

  it("passes the reader vocabulary guards", () => {
    expect(findForbiddenOpsTerms(copy)).toEqual([]);
    expect(findForbiddenDesignTerms(copy)).toEqual([]);
    expect(findLiveTokenViolations(copy)).toEqual([]);
  });
});

describe("LandmarkMeter — ETH spot ETF row (2026-10-17 evening)", () => {
  it("renders the ETH row next to the BTC ETF row", () => {
    const { container } = renderMeter(undefined, sectionEve, NOW_EVE);
    const rows = [...container.querySelectorAll("[data-landmark-row]")].map((row) => row.getAttribute("data-landmark-row"));
    expect(rows.slice(5, 7)).toEqual(["etf", "ethEtf"]);
    const eth = container.querySelector('[data-landmark-row="ethEtf"]')!.textContent ?? "";
    expect(eth).toContain("米国 ETH 現物 ETF");
    expect(eth).toContain("累計純流入");
    expect(eth).toContain("累計 129.7 億ドル（10/16 時点・Farside / SoSoValue 集計）");
    expect(eth).toContain("累計が過去最高を更新する");
    expect(eth).toContain("最高（2025年10月8日・151.1 億ドル）まで 21.4 億ドル");
    expect(eth).toContain("2025年6月3日");
    expect(eth).toContain("上場（2024 年）以降 2 回");
    expect(eth).not.toContain("—");
    expect(eth).not.toContain("変更");
    const btc = container.querySelector('[data-landmark-row="etf"]')!.textContent ?? "";
    expect(btc).toContain("最高（2025年10月9日・627.4 億ドル）まで 58.1 億ドル");
    expect(btc).not.toContain("Farside");
    const text = container.textContent ?? "";
    expect(text).toContain(
      "Farside Investors（上場〜2026年10月16日）と SoSoValue（それ以降の確定日）の日次をつないだ値（ETH 現物 ETF）",
    );
    expect(text).toContain("点灯は指標ごとに過去 1〜6 回で");
    expect(container.querySelector('[data-landmark-row="ethEtf"] strong')).toBeNull();
  });

  it("shows the ETH fired badge, cooldown and the current-high wording", () => {
    const fired = renderMeter((d) => {
      d.items[6].lastEvent = "2026-10-16";
      d.items[6].count = 3;
      d.items[6].values = { cum: "152.0", peak: "152.0", toPeak: "0.0", peakDate: "2026-10-16" };
    }, sectionEve, NOW_EVE);
    const eth = fired.container.querySelector('[data-landmark-row="ethEtf"]')!.textContent ?? "";
    expect(eth).toContain("点灯2026年10月16日に最高を更新");
    expect(eth).toContain("いまの値が最高（2026年10月16日）");
    expect(eth).not.toContain("まで 0.0 億ドル");
    fired.unmount();
    const cooling = renderMeter((d) => {
      d.items[6].state = "cooldown";
      d.items[6].eligibleFrom = "2027-01-14";
    }, sectionEve, NOW_EVE);
    const ethCool = cooling.container.querySelector('[data-landmark-row="ethEtf"]')!.textContent ?? "";
    expect(ethCool).toContain("休止期間2027年1月14日から再び数える");
  });

  it("bolds the ETH date when its value is 7 or more days old", () => {
    const { container } = renderMeter((d) => {
      d.items[6].barDate = "2026-10-09";
    }, sectionEve, NOW_EVE);
    expect(container.querySelector('[data-landmark-row="ethEtf"] strong')?.textContent).toBe(
      "10/9 時点・Farside / SoSoValue 集計",
    );
  });
});

describe("LandmarkMeter — update time (2026-10-29)", () => {
  it("shows the newest check time under the title", () => {
    const { container } = renderMeter(undefined, sectionEve, NOW_EVE);
    const updated = container.querySelector("[data-landmark-updated]");
    expect(updated?.textContent).toBe("最終更新 10月17日 19:15");
    expect(updated?.querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-17T19:15:08+09:00");
    // 見出しのすぐ下・説明文より上
    expect(screen.getByRole("heading", { level: 2 }).nextElementSibling).toBe(updated);
  });

  it("adds no row note when every row comes from the newest check", () => {
    const { container } = renderMeter(undefined, sectionEve, NOW_EVE);
    expect(container.querySelector("[data-landmark-checked-behind]")).toBeNull();
  });

  it("notes the check time only on rows left from an earlier check", () => {
    const { container } = renderMeter((d) => {
      d.items[7].checkedAtJst = "2026-10-17T10:15:05+09:00";
      d.items[8].checkedAtJst = "2026-10-17T10:15:05+09:00";
    }, sectionEve, NOW_EVE);
    expect(container.querySelector("[data-landmark-updated]")?.textContent).toBe("最終更新 10月17日 19:15");
    const noted = [...container.querySelectorAll("[data-landmark-checked-behind]")].map(
      (note) => note.closest("[data-landmark-row]")!.getAttribute("data-landmark-row"),
    );
    expect(noted).toEqual(["stableYoy", "stableAth"]);
    const yoy = container.querySelector('[data-landmark-row="stableYoy"] [data-landmark-checked-behind]')!;
    expect(yoy.textContent).toBe("この行は 10月17日 10:15 時点の判定");
    // データの日付 (何日分の値か) はそのまま残す
    expect(container.querySelector('[data-landmark-row="stableYoy"]')!.textContent).toContain("（10/16・DefiLlama 集計）");
  });
});

describe("LandmarkMeter — sparklines (2026-10-18・core spec 2026-10-17-lvm-landmark-meter-sparkline-design)", () => {
  it("draws one sparkline per row under the name and a legend under the lead", () => {
    const { container } = renderMeter(undefined, sectionSeries, NOW_EVE);
    const rows = [...container.querySelectorAll("[data-landmark-row]")];
    expect(rows).toHaveLength(9);
    for (const row of rows) {
      const chart = row.querySelector("[data-landmark-sparkline]");
      expect(chart, row.getAttribute("data-landmark-row")!).not.toBeNull();
      expect(chart!.getAttribute("aria-hidden")).toBe("true");
      // 名前の行のすぐ下・「いま」の行より上
      expect(row.children[1]).toBe(chart);
    }
    const kinds = rows.map((row) => row.querySelector("[data-landmark-sparkline]")!.getAttribute("data-landmark-sparkline"));
    expect(kinds).toEqual(["line", "bars", "bars", "line", "line", "peak", "peak", "line", "peak"]);
    const legend = container.querySelector("[data-landmark-chart-legend]");
    expect(legend?.textContent).toContain("グラフは過去 2 年");
    expect(legend?.textContent).toContain("縦線は過去の点灯");
  });

  it("draws the past firing days, the reference line and the current point", () => {
    const { container } = renderMeter(undefined, sectionSeries, NOW_EVE);
    const row = (key: string) => container.querySelector(`[data-landmark-row="${key}"]`)!;
    expect(row("ma200w").querySelectorAll("[data-landmark-event]")).toHaveLength(1);
    expect(row("ethEtf").querySelectorAll("[data-landmark-event]")).toHaveLength(2);
    expect(row("mvrv").querySelectorAll("[data-landmark-event]")).toHaveLength(0);
    expect(row("ma200w").querySelector("[data-landmark-ref]")).not.toBeNull();
    expect(row("etf").querySelector("[data-landmark-ref]")).toBeNull();
    expect(row("etf").querySelector("[data-landmark-peak]")).not.toBeNull();
    expect(row("ma200w").querySelectorAll("[data-landmark-now]")).toHaveLength(1);
    const dot = row("ma200w").querySelector<HTMLElement>("[data-landmark-now]")!;
    expect(dot.style.left).toMatch(/%$/);
    expect(dot.style.top).toMatch(/%$/);
    expect(row("macd2w").querySelectorAll('[data-landmark-bar="now"]')).toHaveLength(1);
    expect(row("macd2w").querySelectorAll('[data-landmark-bar="outside"]').length).toBeGreaterThan(0);
    expect(row("macd1m").querySelectorAll('[data-landmark-bar="outside"]')).toHaveLength(0);
    expect(row("ma200w").querySelector("[data-landmark-ticks]")?.textContent).toBe("20252026");
  });

  it("uses theme tokens only and no status colors, meters or text inside the chart", () => {
    const { container } = renderMeter(undefined, sectionSeries, NOW_EVE);
    expect(container.innerHTML).not.toMatch(/status-up|status-down|staleness-|<progress|role="meter"|#[0-9a-f]{3,6}\b/i);
    for (const svg of container.querySelectorAll("[data-landmark-sparkline] svg")) {
      expect(svg.querySelector("text")).toBeNull();
    }
  });

  it("draws no chart for a row without a series or without fresh data, and no legend without any series", () => {
    const partial = renderMeter((d) => {
      delete d.items[0].series;
      d.items = d.items.filter((item) => item.key !== "btc_etf_cum_high");
    }, sectionSeries, NOW_EVE);
    expect(partial.container.querySelector('[data-landmark-row="ma200w"] [data-landmark-sparkline]')).toBeNull();
    expect(partial.container.querySelector('[data-landmark-row="etf"] [data-landmark-sparkline]')).toBeNull();
    expect(partial.container.querySelector('[data-landmark-row="macd2w"] [data-landmark-sparkline]')).not.toBeNull();
    expect(partial.container.querySelector("[data-landmark-chart-legend]")).not.toBeNull();
    partial.unmount();
    const none = renderMeter(undefined, sectionEve, NOW_EVE);
    expect(none.container.querySelector("[data-landmark-sparkline]")).toBeNull();
    expect(none.container.querySelector("[data-landmark-chart-legend]")).toBeNull();
  });

  it("keeps every number and sentence of the cards when charts are added", () => {
    const withCharts = renderMeter(undefined, sectionSeries, NOW_EVE);
    const textWith = [...withCharts.container.querySelectorAll("[data-landmark-row] dl")].map((dl) => dl.textContent);
    withCharts.unmount();
    const without = renderMeter(undefined, sectionEve, NOW_EVE);
    const textWithout = [...without.container.querySelectorAll("[data-landmark-row] dl")].map((dl) => dl.textContent);
    expect(textWith).toEqual(textWithout);
  });
});
