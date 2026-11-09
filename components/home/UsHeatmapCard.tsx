import type { HeatmapData } from "@/lib/terminal/live-market-feed";

/**
 * 昨夜の米国株 (2026-11-10 田平氏承認)。X の PNG と同じ図を SVG で描く。
 * 図の領域は 1600x700 (16:7・controller R1) で、rect (0〜1) × 1600/700。
 * 見出し・subline は SVG の外の普通の文字 (subline に「M/D の米国市場」が入る)。
 * 色は changeLabel の数値から 6 段 (米国式: 上げ=緑 / 下げ=赤)。
 * 8px 未満の四角には文字を描かない (PNG の MIN_TILE と同じ)。
 */
const CHART_W = 1600;
const CHART_H = 700;
const GAP = 3;
const RADIUS = 10;
const MIN_TILE = 8;
const MIN_SYMBOL_PX = 8;
const MIN_LABEL_PX = 9;
const PAD = 4;
const BG = "#fff6e6";
const SECTOR_FRAME = "#1a1f36";
const SECTOR_INK = "#ffffff";

export interface UsHeatmapCardCopy {
  title: string;
  tooltip: (symbol: string, changeLabel: string) => string;
}

/** "+2.11%" / "-0.50%" / "0.00%" → 塗りと文字の色 (境界 ≥+5・≥+2・≥0・>−2・>−5・それ以下)。 */
export function heatmapTileColors(changeLabel: string): { fill: string; ink: string } {
  const pct = Number.parseFloat(changeLabel.replace("−", "-"));
  if (pct >= 5) return { fill: "#00a86b", ink: "#ffffff" };
  if (pct >= 2) return { fill: "#36d17f", ink: "#0b2a1c" };
  if (pct >= 0) return { fill: "#bff0cf", ink: "#0b2a1c" };
  if (pct > -2) return { fill: "#ffc2c7", ink: "#3a0d12" };
  if (pct > -5) return { fill: "#ff7a85", ink: "#3a0d12" };
  return { fill: "#e8323f", ink: "#ffffff" };
}

/** 業種の見出し帯の高さ (正規化・controller R2)。 */
function bandHeight(sectorH: number): number {
  return Math.min(Math.max(0.06 * sectorH, 0.035), 0.5 * sectorH);
}

/** 文字幅の目安 (em 単位): ASCII は 0.62em・それ以外 (日本語) は 1em。 */
function textEm(text: string): number {
  let em = 0;
  for (const ch of text) em += ch.charCodeAt(0) < 0x80 ? 0.62 : 1;
  return em;
}

/** width に収まる最大のフォントサイズ (maxSize 以下)。 */
function fitSize(text: string, maxSize: number, width: number): number {
  return Math.min(maxSize, width / Math.max(textEm(text), 1));
}

export function UsHeatmapCard({
  heatmap,
  copy,
}: {
  heatmap: HeatmapData | null;
  copy: UsHeatmapCardCopy;
}) {
  if (!heatmap) return null;
  return (
    <section
      data-us-heatmap
      data-session-date={heatmap.sessionDate}
      className="rounded-lg border border-border-primary bg-bg-secondary p-4"
    >
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <p className="mt-2 text-base font-bold text-text-primary">{heatmap.headline}</p>
      <p className="mt-1 text-xs text-text-secondary">{heatmap.subline}</p>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label={`${copy.title}｜${heatmap.subline}`}
        className="mt-3 h-auto w-full"
      >
        <rect x={0} y={0} width={CHART_W} height={CHART_H} fill={BG} />
        {heatmap.sectors.map((sector, sectorIndex) => {
          const [nx, ny, nw, nh] = sector.rect;
          const sx = nx * CHART_W;
          const sy = ny * CHART_H;
          const sw = nw * CHART_W;
          const sh = nh * CHART_H;
          const band = bandHeight(nh) * CHART_H;
          const header = `${sector.name} ${sector.changeLabel}`;
          const headerSize = fitSize(header, Math.min(band * 0.7, 28), sw - 12 - 2 * PAD);
          return (
            <g key={`${sectorIndex}-${sector.name}`}>
              <rect
                x={sx + GAP / 2}
                y={sy + GAP / 2}
                width={Math.max(sw - GAP, 0)}
                height={Math.max(sh - GAP, 0)}
                rx={RADIUS}
                fill={SECTOR_FRAME}
              />
              {band >= MIN_TILE && sw >= MIN_TILE && headerSize >= MIN_SYMBOL_PX ? (
                <text
                  data-us-heatmap-sector
                  x={sx + 6 + PAD}
                  y={sy + band / 2}
                  dominantBaseline="central"
                  fontSize={headerSize}
                  fontWeight={700}
                  fill={SECTOR_INK}
                >
                  {header}
                </text>
              ) : null}
              {sector.items.map((item) => {
                const [ix, iy, iw, ih] = item.rect;
                const x = ix * CHART_W;
                const y = iy * CHART_H;
                const w = iw * CHART_W - GAP;
                const h = ih * CHART_H - GAP;
                const { fill, ink } = heatmapTileColors(item.changeLabel);
                const symbolSize = fitSize(item.symbol, Math.min(w / 4, h / 3, 64), w - 2 * PAD);
                const labelSize = fitSize(item.changeLabel, symbolSize * 0.7, w - 2 * PAD);
                const showSymbol = w >= MIN_TILE && h >= MIN_TILE && symbolSize >= MIN_SYMBOL_PX;
                const showLabel = showSymbol && labelSize >= MIN_LABEL_PX;
                const block = symbolSize + (showLabel ? labelSize * 1.1 : 0);
                const top = y + GAP / 2 + Math.max((h - block) / 2, 0);
                const cx = x + GAP / 2 + w / 2;
                return (
                  <g key={item.symbol}>
                    <rect
                      data-us-heatmap-tile
                      x={x + GAP / 2}
                      y={y + GAP / 2}
                      width={Math.max(w, 0)}
                      height={Math.max(h, 0)}
                      rx={Math.max(Math.min(RADIUS, w / 2, h / 2), 0)}
                      fill={fill}
                    >
                      <title>{copy.tooltip(item.symbol, item.changeLabel)}</title>
                    </rect>
                    {showSymbol ? (
                      <text
                        data-us-heatmap-symbol
                        x={cx}
                        y={top}
                        textAnchor="middle"
                        dominantBaseline="hanging"
                        fontSize={symbolSize}
                        fontWeight={700}
                        fill={ink}
                        pointerEvents="none"
                      >
                        {item.symbol}
                      </text>
                    ) : null}
                    {showLabel ? (
                      <text
                        x={cx}
                        y={top + symbolSize * 1.15}
                        textAnchor="middle"
                        dominantBaseline="hanging"
                        fontSize={labelSize}
                        fill={ink}
                        pointerEvents="none"
                      >
                        {item.changeLabel}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
