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

const NOW = new Date("2026-10-16T10:45:00Z"); // 19:45 JST
const t = createTranslator({
  locale: "ja",
  messages: ja,
  namespace: "articles.landmarkMeter",
}) as unknown as LandmarkMeterTranslate;

function renderMeter(mutate?: (d: LandmarkMeterData) => void) {
  const data = mapLandmarkMeter(structuredClone(section));
  if (!data) throw new Error("fixture must be valid");
  mutate?.(data);
  const rows = buildLandmarkRows(data, NOW);
  if (!rows) throw new Error("rows must exist");
  return render(<LandmarkMeter rows={rows} t={t} />);
}

describe("LandmarkMeter", () => {
  it("renders the six rows of the 2026-10-16 section in Japanese", () => {
    const { container } = renderMeter();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("節目の計器盤");
    const rows = container.querySelectorAll("[data-landmark-row]");
    expect([...rows].map((row) => row.getAttribute("data-landmark-row"))).toEqual([
      "ma200w", "macd2w", "macd1m", "mvrv", "funding", "etf",
    ]);
    const text = container.textContent ?? "";
    expect(text).toContain("終値 83,637 ドル・200 週平均 66,506 ドル（10/11 の週）");
    expect(text).toContain("平均との差 +25.8%");
    expect(text).toContain("2027年8月22日の週から再び数える");
    expect(text).toContain("シグナルとの差 +2,352");
    expect(text).toContain("次の点灯は、一度シグナル線を下回ってから");
    expect(text).toContain("次の判定は 10/31 の確定足");
    expect(text).toContain("2026年10月3日に、ゼロ線の下に限る形から上下を問わない形へ変更");
    expect(text).toContain("回復は、割れた後に判定");
    expect(text).toContain("2026年11月19日から再び数える");
    expect(text).toContain("最高（2025年10月9日・627.4 億ドル）まで 50.7 億ドル");
    expect(text).toContain("上場（2024 年）以降 1 回");
    expect(text).toContain("2014 年以降 4 回");
    expect(text).toContain("点灯は指標ごとに過去 1〜5 回で");
    // ETF は Farside の保存が 14 日前なので日付を太字にする
    const etf = container.querySelector('[data-landmark-row="etf"]');
    expect(etf?.querySelector("strong")?.textContent).toBe("10/2 時点・Farside 集計");
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
