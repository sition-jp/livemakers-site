import type { LandmarkRowKey, LandmarkSeries } from "@/lib/landmark/meter-feed";
import { SPARK_HEIGHT, SPARK_WIDTH, buildSparkline } from "@/lib/landmark/sparkline";

/**
 * 節目の計器盤のカードの推移グラフ (core spec 2026-10-17-lvm-landmark-meter-sparkline-design §6)。サーバー部品。
 * 過去 2 年の線 (MACD は棒)・点灯の線 (点線)・過去の点灯 (縦線)・いまの点。グラフは補助で、事実はカードの文字にある
 * ので読み上げから外す (aria-hidden)。色はトークンだけ・近い / 遠いで色や太さを変えない。SVG の中に文字を置かない。
 */
const STROKE = { vectorEffect: "non-scaling-stroke" } as const;

export function LandmarkSparkline({ rowKey, series }: { rowKey: LandmarkRowKey; series: LandmarkSeries }) {
  const g = buildSparkline(rowKey, series);
  return (
    <div data-landmark-sparkline={g.kind} aria-hidden="true" className="mt-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          preserveAspectRatio="none"
          focusable="false"
          className="block h-12 w-full overflow-visible"
        >
          {g.ticks.map((tick) => (
            <line
              key={tick.label}
              x1={tick.x}
              x2={tick.x}
              y1={SPARK_HEIGHT - 3}
              y2={SPARK_HEIGHT}
              stroke="currentColor"
              strokeWidth={1}
              className="text-text-tertiary"
              {...STROKE}
            />
          ))}
          {g.events.map((x, index) => (
            <line
              key={`event-${index}`}
              data-landmark-event
              x1={x}
              x2={x}
              y1={0}
              y2={SPARK_HEIGHT}
              stroke="currentColor"
              strokeWidth={1}
              strokeOpacity={0.7}
              className="text-text-tertiary"
              {...STROKE}
            />
          ))}
          {g.refY !== null ? (
            <line
              data-landmark-ref
              x1={0}
              x2={SPARK_WIDTH}
              y1={g.refY}
              y2={g.refY}
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="2 3"
              className="text-text-tertiary"
              {...STROKE}
            />
          ) : null}
          {g.peak ? (
            <polyline
              data-landmark-peak
              points={g.peak}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="2 3"
              className="text-text-tertiary"
              {...STROKE}
            />
          ) : null}
          {g.bars.map((bar, index) => (
            <rect
              key={`bar-${index}`}
              data-landmark-bar={bar.tone}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              fill={bar.tone === "outside" ? "none" : "currentColor"}
              fillOpacity={bar.tone === "past" ? 0.55 : undefined}
              stroke={bar.tone === "outside" ? "currentColor" : "none"}
              strokeWidth={bar.tone === "outside" ? 1 : undefined}
              className={bar.tone === "now" ? "text-accent" : "text-text-tertiary"}
              {...STROKE}
            />
          ))}
          {g.line ? (
            <polyline
              data-landmark-line
              points={g.line}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="text-text-secondary"
              {...STROKE}
            />
          ) : null}
        </svg>
        {g.now ? (
          <span
            data-landmark-now
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-bg-primary"
            style={{ left: `${g.now.leftPct}%`, top: `${g.now.top}px` }}
          />
        ) : null}
      </div>
      <div data-landmark-ticks className="relative h-3.5 font-mono text-[10px] leading-[14px] text-text-tertiary">
        {g.ticks.map((tick) => (
          <span key={tick.label} className="absolute top-0 -translate-x-1/2" style={{ left: `${tick.leftPct}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
