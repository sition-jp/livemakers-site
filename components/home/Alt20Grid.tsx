import type { Alt20Data } from "@/lib/terminal/live-market-feed";

const TILE_TONE: Record<"up" | "down" | "flat", string> = {
  up: "text-status-up bg-status-up/10",
  down: "text-status-down bg-status-down/10",
  flat: "text-text-secondary bg-bg-tertiary",
};

export interface Alt20GridCopy {
  summary: (summary: Alt20Data["summary"]) => string;
  unavailable: string;
}

/** 主要アルトコイン20 の 4列×5行のマス (symbol + 24h 変化率)。上昇=赤 / 下落=青。 */
export function Alt20Grid({
  alt20,
  copy,
}: {
  alt20: Alt20Data | null;
  copy: Alt20GridCopy;
}) {
  if (!alt20) {
    return <p className="text-sm text-text-secondary">{copy.unavailable}</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary">{copy.summary(alt20.summary)}</p>
      <ol className="grid grid-cols-4 gap-px">
        {alt20.items.map((item) => (
          <li
            key={item.symbol}
            data-testid="alt20-tile"
            className={`flex flex-col items-center rounded-sm px-1 py-1.5 ${TILE_TONE[item.direction]}`}
          >
            <span className="font-mono text-xs font-semibold">{item.symbol}</span>
            <span className="font-mono text-[11px]">{item.changeLabel}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
