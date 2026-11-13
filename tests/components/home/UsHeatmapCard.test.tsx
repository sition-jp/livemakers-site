/* @vitest-environment jsdom */
import fs from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  UsHeatmapCard,
  heatmapTextVisibility,
  heatmapTileColors,
} from "@/components/home/UsHeatmapCard";
import type { HeatmapData } from "@/lib/terminal/live-market-feed";

const section = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/us-heatmap/section.json"), "utf8"),
) as Record<string, any>;

const heatmap: HeatmapData = {
  asOfJst: section.asOfJst,
  listVersion: section.listVersion,
  sessionDate: section.sessionDate,
  headline: section.headline,
  subline: section.subline,
  summary: section.summary,
  sectors: section.sectors,
  themes: [],
};

const copy = {
  title: "昨夜の米国市場",
  tooltip: (symbol: string, changeLabel: string) => `${symbol} ${changeLabel}`,
  themesTitle: "テーマ（単純平均）",
  themeTooltip: (name: string, changeLabel: string, members: string[]) =>
    `${name} ${changeLabel}: ${members.join("・")}`,
};

function tiles(container: HTMLElement) {
  return Array.from(container.querySelectorAll("rect[data-us-heatmap-tile]"));
}

describe("UsHeatmapCard", () => {
  it("renders nothing when heatmap is null", () => {
    const { container } = render(<UsHeatmapCard heatmap={null} copy={copy} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders session date label", () => {
    render(<UsHeatmapCard heatmap={heatmap} copy={copy} />);
    expect(screen.getByText("昨夜の米国市場")).toBeTruthy();
    expect(screen.getByText("半導体が全体を押し上げ")).toBeTruthy();
    const subline = screen.getByText(/11\/9 の米国市場/);
    // 見出し・subline は SVG の外の普通の文字
    expect(subline.closest("svg")).toBeNull();
  });

  it("renders one rect per item with title", () => {
    const { container } = render(<UsHeatmapCard heatmap={heatmap} copy={copy} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 1600 700");
    const rects = tiles(container);
    expect(rects).toHaveLength(3);
    expect(rects.map((r) => r.querySelector("title")?.textContent)).toEqual([
      "NVDA +5.50%",
      "AAPL +2.11%",
      "LLY -0.50%",
    ]);
    // rect は x*1600, y*700, w*1600, h*700 (隙間の分だけ内側)
    const aapl = rects[1];
    expect(Number(aapl.getAttribute("x"))).toBeCloseTo(0.5102 * 1600 + 1.5, 1);
    expect(Number(aapl.getAttribute("y"))).toBeCloseTo(0.06 * 700 + 1.5, 1);
    expect(Number(aapl.getAttribute("width"))).toBeCloseTo(0.4082 * 1600 - 3, 1);
    expect(Number(aapl.getAttribute("height"))).toBeCloseTo(0.94 * 700 - 3, 1);
    expect(aapl.getAttribute("fill")).toBe("#36d17f");
    expect(rects[0].getAttribute("fill")).toBe("#00a86b");
    expect(rects[2].getAttribute("fill")).toBe("#ffc2c7");
  });

  it("writes the sector header in white, hiding it on narrow cards", () => {
    const { container } = render(<UsHeatmapCard heatmap={heatmap} copy={copy} />);
    const headers = Array.from(container.querySelectorAll("text[data-us-heatmap-sector]"));
    // ヘルスケアの帯は幅が狭く 11 単位 → どの幅でも 9px に届かないので描かない (凡例が担う)
    expect(headers.map((t) => t.textContent)).toEqual(["半導体 +5.50%", "テック +2.11%"]);
    expect(headers.every((t) => t.getAttribute("fill") === "#ffffff")).toBe(true);
    // 28 単位 → 9px に要るカード幅 514px → 640px 未満で隠す
    expect(headers.map((t) => t.getAttribute("class"))).toEqual([
      "@max-[640px]:hidden",
      "@max-[640px]:hidden",
    ]);
  });

  it("hides the sector header when the band is under 8 units", () => {
    const thin: HeatmapData = structuredClone(heatmap);
    // 帯 = min(max(0.06*0.02, 0.035), 0.5*0.02) * 700 = 7 単位
    thin.sectors[1].rect = [0.5102, 0, 0.4082, 0.02];
    thin.sectors[1].items[0].rect = [0.5102, 0.01, 0.4082, 0.01];
    const { container } = render(<UsHeatmapCard heatmap={thin} copy={copy} />);
    const headers = Array.from(container.querySelectorAll("text[data-us-heatmap-sector]"));
    expect(headers.map((t) => t.textContent)).toEqual(["半導体 +5.50%"]);
  });

  it("shows the symbol but hides the label when the label font is too small", () => {
    const short: HeatmapData = structuredClone(heatmap);
    // 高さ 60 単位 → 銘柄 20 単位 (960px 未満で隠す)・% は 14 単位 → 描かない
    short.sectors[1].items[0].rect = [0.5102, 0.06, 0.4082, 0.09];
    const { container } = render(<UsHeatmapCard heatmap={short} copy={copy} />);
    const symbols = Array.from(container.querySelectorAll("text[data-us-heatmap-symbol]"));
    const aapl = symbols.find((t) => t.textContent === "AAPL")!;
    expect(aapl.getAttribute("class")).toBe("@max-[960px]:hidden");
    const labels = Array.from(container.querySelectorAll("text[data-us-heatmap-label]")).map(
      (t) => t.textContent,
    );
    expect(labels).not.toContain("+2.11%");
    expect(labels).toContain("+5.50%");
  });

  it("gives small-font text the card-width class that keeps it at 9px or more", () => {
    const { container } = render(<UsHeatmapCard heatmap={heatmap} copy={copy} />);
    const classOf = (selector: string, text: string) =>
      Array.from(container.querySelectorAll(selector))
        .find((t) => t.textContent === text)
        ?.getAttribute("class") ?? null;
    // NVDA 64 単位 → 225px で 9px → 常に出す (class なし)
    expect(classOf("text[data-us-heatmap-symbol]", "NVDA")).toBeNull();
    // LLY 31.9 単位 → 451px → 480px 未満で隠す
    expect(classOf("text[data-us-heatmap-symbol]", "LLY")).toBe("@max-[480px]:hidden");
    // LLY の % 22.3 単位 → 645px → 960px 未満で隠す
    expect(classOf("text[data-us-heatmap-label]", "-0.50%")).toBe("@max-[960px]:hidden");
    expect(container.querySelector("section")?.className).toContain("@container");
  });

  it.each([
    [45, ""],
    [44.9, "@max-[480px]:hidden"],
    [30, "@max-[480px]:hidden"],
    [29.9, "@max-[640px]:hidden"],
    [22.5, "@max-[640px]:hidden"],
    [22.4, "@max-[960px]:hidden"],
    [15, "@max-[960px]:hidden"],
    [14.9, null],
  ])("maps a %s-unit font to %j", (size, expected) => {
    expect(heatmapTextVisibility(size)).toBe(expected);
  });

  it("renders a sector legend chip per sector in payload order", () => {
    const { container } = render(<UsHeatmapCard heatmap={heatmap} copy={copy} />);
    const legend = container.querySelector("[data-us-heatmap-legend]")!;
    expect(legend.closest("svg")).toBeNull();
    const chips = Array.from(legend.querySelectorAll("[data-us-heatmap-legend-chip]")) as HTMLElement[];
    expect(chips.map((c) => c.textContent)).toEqual([
      "半導体 +5.50%",
      "テック +2.11%",
      "ヘルスケア -0.50%",
    ]);
    expect(chips.map((c) => [c.style.backgroundColor, c.style.color])).toEqual([
      ["rgb(0, 168, 107)", "rgb(255, 255, 255)"],
      ["rgb(54, 209, 127)", "rgb(11, 42, 28)"],
      ["rgb(255, 194, 199)", "rgb(58, 13, 18)"],
    ]);
  });

  it("draws no text on a tile under 8px", () => {
    const tiny: HeatmapData = structuredClone(heatmap);
    // 0.004 * 1600 = 6.4px 幅 → 四角は描くが文字は描かない
    tiny.sectors[2].items[0].rect = [0.9184, 0.06, 0.004, 0.94];
    const { container } = render(<UsHeatmapCard heatmap={tiny} copy={copy} />);
    expect(tiles(container)).toHaveLength(3);
    const labels = Array.from(container.querySelectorAll("text[data-us-heatmap-symbol]")).map(
      (t) => t.textContent,
    );
    expect(labels).toContain("NVDA");
    expect(labels).not.toContain("LLY");
  });

  it.each([
    ["+5.00%", "#00a86b", "#ffffff"],
    ["+4.99%", "#36d17f", "#0b2a1c"],
    ["+2.00%", "#36d17f", "#0b2a1c"],
    ["+1.99%", "#bff0cf", "#0b2a1c"],
    ["0.00%", "#bff0cf", "#0b2a1c"],
    ["-0.01%", "#ffc2c7", "#3a0d12"],
    ["-1.99%", "#ffc2c7", "#3a0d12"],
    ["-2.00%", "#ff7a85", "#3a0d12"],
    ["-4.99%", "#ff7a85", "#3a0d12"],
    ["-5.00%", "#e8323f", "#ffffff"],
  ])("colours %s as %s on %s", (label, fill, ink) => {
    expect(heatmapTileColors(label)).toEqual({ fill, ink });
  });

  // 2026-11-14 テーマの段 (core spec 2026-11-14-us-heatmap-theme-row-design §5.4)
  describe("theme row", () => {
    const withThemes: HeatmapData = {
      ...structuredClone(heatmap),
      themes: [
        { name: "AI関連", changeLabel: "+5.50%", direction: "up", members: ["NVDA", "AAPL"] },
        { name: "電力", changeLabel: "-0.50%", direction: "down", members: ["AAPL", "LLY"] },
      ],
    };

    it("draws a chip per theme under the sector legend, with its title", () => {
      const { container } = render(<UsHeatmapCard heatmap={withThemes} copy={copy} />);
      const row = container.querySelector("[data-us-heatmap-themes]");
      expect(row).not.toBeNull();
      expect(row?.textContent).toContain("テーマ（単純平均）");
      // 区分の凡例の後ろに置く
      const legend = container.querySelector("[data-us-heatmap-legend]");
      expect(legend?.compareDocumentPosition(row as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      const chips = Array.from(
        container.querySelectorAll<HTMLElement>("[data-us-heatmap-theme-chip]"),
      );
      expect(chips.map((c) => c.textContent)).toEqual(["AI関連 +5.50%", "電力 -0.50%"]);
      expect(chips.map((c) => c.getAttribute("title"))).toEqual([
        "AI関連 +5.50%: NVDA・AAPL",
        "電力 -0.50%: AAPL・LLY",
      ]);
      // 色は区分のチップと同じ関数
      const probe = document.createElement("div");
      probe.style.backgroundColor = heatmapTileColors("+5.50%").fill;
      probe.style.color = heatmapTileColors("+5.50%").ink;
      expect(chips[0].style.backgroundColor).toBe(probe.style.backgroundColor);
      expect(chips[0].style.color).toBe(probe.style.color);
    });

    it("draws no theme row when there are no themes", () => {
      const { container } = render(<UsHeatmapCard heatmap={heatmap} copy={copy} />);
      expect(container.querySelector("[data-us-heatmap-themes]")).toBeNull();
      expect(container.textContent).not.toContain("テーマ（単純平均）");
    });
  });
});
