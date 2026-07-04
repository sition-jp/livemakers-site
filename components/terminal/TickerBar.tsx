import {
  marketTickerFixture,
  type MarketTickerItem,
} from "@/lib/terminal/market-lanes";

/**
 * G39-A2: the ticker follows the doctrine lanes (macro / crypto / RWA)
 * instead of the retired ADA/EPOCH network strip. G39-B B2 feeds it from the
 * SDE terminal feed (same payload as the lane windows — doctrine §4: one
 * payload, no per-window fetch); the fixture stays as fallback. The leading
 * pill states the freshness provenance honestly (design §3: never fake
 * real-time — SNAPSHOT/SESSION, or Fixture while unconnected). Server
 * component — no client fetch.
 */

function formatDelta(deltaPct: number | undefined): string {
  if (deltaPct === undefined) return "";
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}%`;
}

function provenanceLabel(items: MarketTickerItem[]): string {
  const badges = Array.from(
    new Set(items.map((item) => item.badge ?? "FIXTURE")),
  );
  if (badges.length === 1 && badges[0] === "FIXTURE") return "Fixture";
  return badges.join(" · ");
}

export function TickerBar({
  items = marketTickerFixture,
}: {
  items?: MarketTickerItem[];
}) {
  return (
    <div className="border-y border-border-primary bg-bg-secondary">
      <div className="mx-auto flex max-w-[1920px] items-center gap-6 overflow-x-auto px-6 py-3 text-xs tracking-label">
        <span className="shrink-0 border border-border-primary px-1.5 py-0.5 font-mono text-[9px] uppercase text-text-tertiary">
          {provenanceLabel(items)}
        </span>
        {items.map((item) => {
          const delta = formatDelta(item.deltaPct);
          const deltaColor = delta.startsWith("-")
            ? "text-status-down"
            : delta.startsWith("+")
              ? "text-status-up"
              : "text-text-tertiary";
          return (
            <div
              key={item.id}
              className="flex items-baseline gap-2 whitespace-nowrap"
            >
              <span className="text-text-tertiary">{item.label}</span>
              <span className="font-bold tabular-nums text-text-primary">
                {item.value}
              </span>
              {delta && <span className={`tabular-nums ${deltaColor}`}>{delta}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
