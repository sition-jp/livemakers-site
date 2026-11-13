import type { HeatmapData } from "@/lib/terminal/live-market-feed";

/**
 * 昨夜の米国株 (2026-11-10 田平氏承認)。X の PNG と同じ図を SVG で描く。
 * 図の領域は 1600x700 (16:7・controller R1) で、rect (0〜1) × 1600/700。
 * 見出し・subline は SVG の外の普通の文字 (subline に「M/D の米国市場」が入る)。
 * 色は changeLabel の数値から 6 段 (米国式: 上げ=緑 / 下げ=赤)。
 * 8 単位未満の四角には文字を描かない (PNG の MIN_TILE と同じ)。
 *
 * 文字を出すかは、画面上の大きさ (CSS px) で決める (controller R11)。SVG はカードの幅に
 * 縮むので、viewBox の単位のままだとスマホでは 1〜2px になる。カードを @container にし、
 * 文字ごとに「9px で描ける最小のカード幅」から @max-[…]:hidden の段を選ぶ。
 * 図の下には業種の凡例 (HTML) を常に出す — スマホで帯の文字が隠れても業種が読める。
 * その下にテーマの段 (2026-11-14・core spec 2026-11-14-us-heatmap-theme-row-design)。
 * テーマは区分をまたぐ銘柄群の単純平均で、色は区分のチップと同じ。テーマが無い日は段ごと出さない。
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

/** 画面上でこの大きさ (CSS px) 未満になる文字は隠す (R11)。 */
export const MIN_RENDERED_TEXT_PX = 9;
/** カード幅 (CSS px) の段。この幅で 9px 以上なら常に出す。 */
export const ALWAYS_VISIBLE_CARD_PX = 320;
/** 段ごとの隠し方。クラス名は Tailwind が拾えるよう文字列のまま書く。 */
export const CARD_WIDTH_STEPS: readonly { maxCardPx: number; className: string }[] = [
  { maxCardPx: 480, className: "@max-[480px]:hidden" },
  { maxCardPx: 640, className: "@max-[640px]:hidden" },
  { maxCardPx: 960, className: "@max-[960px]:hidden" },
];

export interface UsHeatmapCardCopy {
  title: string;
  tooltip: (symbol: string, changeLabel: string) => string;
  /** テーマの段の見出し (2026-11-14・「テーマ（単純平均）」)。 */
  themesTitle: string;
  /** テーマのチップの title (平均に入った銘柄を見せる)。 */
  themeTooltip: (name: string, changeLabel: string, members: string[]) => string;
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

/**
 * viewBox 単位のフォントサイズ → 文字に付けるクラス (R11)。
 * "" = 常に出す / "@max-[…]:hidden" = その幅未満のカードで隠す / null = 描かない。
 */
export function heatmapTextVisibility(fontSizeUnits: number): string | null {
  const minCardPx = (MIN_RENDERED_TEXT_PX * CHART_W) / fontSizeUnits;
  if (minCardPx <= ALWAYS_VISIBLE_CARD_PX) return "";
  for (const step of CARD_WIDTH_STEPS) {
    if (minCardPx <= step.maxCardPx) return step.className;
  }
  return null;
}

/** 業種の見出し帯の高さ (正規化・controller R2)。 */
function bandHeight(sectorH: number): number {
  return Math.min(Math.max(0.06 * sectorH, 0.035), 0.5 * sectorH);
}

/**
 * 文字幅の目安 (em・Inter bold を想定)。大文字・数字 0.72em・% 0.9em・それ以外の ASCII
 * 0.62em・日本語 1em。SVG は文字幅を測れないので、少し広めに見積もってはみ出しを防ぐ
 * (clipPath は使わない — R11-3 は見積もりの修正を選んだ)。
 */
function textEm(text: string): number {
  let em = 0;
  for (const ch of text) {
    if (/[A-Z0-9]/.test(ch)) em += 0.72;
    else if (ch === "%") em += 0.9;
    else if (ch.charCodeAt(0) < 0x80) em += 0.62;
    else em += 1;
  }
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
  // v0.1 の形の data (themes 無し) を直接渡されても落ちない
  const themes = heatmap.themes ?? [];
  return (
    <section
      data-us-heatmap
      data-session-date={heatmap.sessionDate}
      className="@container rounded-lg border border-border-primary bg-bg-secondary p-4"
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
          const headerClass =
            band >= MIN_TILE && sw >= MIN_TILE && headerSize >= MIN_SYMBOL_PX
              ? heatmapTextVisibility(headerSize)
              : null;
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
              {headerClass !== null ? (
                <text
                  data-us-heatmap-sector
                  className={headerClass || undefined}
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
                const symbolClass =
                  w >= MIN_TILE && h >= MIN_TILE && symbolSize >= MIN_SYMBOL_PX
                    ? heatmapTextVisibility(symbolSize)
                    : null;
                const labelClass =
                  symbolClass !== null && labelSize >= MIN_LABEL_PX
                    ? heatmapTextVisibility(labelSize)
                    : null;
                const block = symbolSize + (labelClass !== null ? labelSize * 1.1 : 0);
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
                    {symbolClass !== null ? (
                      <text
                        data-us-heatmap-symbol
                        className={symbolClass || undefined}
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
                    {labelClass !== null ? (
                      <text
                        data-us-heatmap-label
                        className={labelClass || undefined}
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
      <ul data-us-heatmap-legend className="mt-2 flex flex-wrap gap-1.5">
        {heatmap.sectors.map((sector, sectorIndex) => {
          const { fill, ink } = heatmapTileColors(sector.changeLabel);
          return (
            <li
              key={`${sectorIndex}-${sector.name}`}
              data-us-heatmap-legend-chip
              className="rounded-sm px-1.5 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: fill, color: ink }}
            >
              {sector.name} {sector.changeLabel}
            </li>
          );
        })}
      </ul>
      {themes.length > 0 ? (
        <div data-us-heatmap-themes className="mt-2">
          <p className="text-[10px] font-bold text-text-secondary">{copy.themesTitle}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {themes.map((theme) => {
              const { fill, ink } = heatmapTileColors(theme.changeLabel);
              return (
                <li
                  key={theme.name}
                  data-us-heatmap-theme-chip
                  title={copy.themeTooltip(theme.name, theme.changeLabel, theme.members)}
                  className="rounded-sm px-1.5 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: fill, color: ink }}
                >
                  {theme.name} {theme.changeLabel}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
