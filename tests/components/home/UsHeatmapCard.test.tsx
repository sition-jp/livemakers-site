/* @vitest-environment jsdom */
import fs from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UsHeatmapCard, heatmapTileColors } from "@/components/home/UsHeatmapCard";
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
};

const copy = {
  title: "昨夜の米国株",
  tooltip: (symbol: string, changeLabel: string) => `${symbol} ${changeLabel}`,
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
    expect(screen.getByText("昨夜の米国株")).toBeTruthy();
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

  it("writes the sector header in white", () => {
    const { container } = render(<UsHeatmapCard heatmap={heatmap} copy={copy} />);
    const headers = Array.from(container.querySelectorAll("text[data-us-heatmap-sector]"));
    expect(headers.map((t) => t.textContent)).toEqual([
      "半導体 +5.50%",
      "テック +2.11%",
      "ヘルスケア -0.50%",
    ]);
    expect(headers.every((t) => t.getAttribute("fill") === "#ffffff")).toBe(true);
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
});
