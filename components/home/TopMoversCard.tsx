import type { MarketSnapshotCell } from "@/lib/home/market-snapshot";
import { marketDirectionClass } from "@/lib/home/market-direction";
import type { WindowProvenance } from "@/lib/provenance/window-provenance";
import {
  WindowProvenanceRow,
  type ProvenanceLabels,
} from "./WindowProvenanceRow";

export interface TopMoversCopy {
  title: string;
  subtitle: string;
  provenance: ProvenanceLabels;
}

export function selectTopMovers(
  cells: MarketSnapshotCell[],
): MarketSnapshotCell[] {
  return [...cells]
    .filter((cell) => cell.changeLabel !== null)
    .sort(
      (left, right) =>
        Math.abs(Number.parseFloat(right.changeLabel!)) -
        Math.abs(Number.parseFloat(left.changeLabel!)),
    )
    .slice(0, 4);
}

export function TopMoversCard({
  cells,
  provenance,
  copy,
}: {
  cells: MarketSnapshotCell[];
  provenance: WindowProvenance;
  copy: TopMoversCopy;
}) {
  const movers = selectTopMovers(cells);
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <p className="mt-1 text-[11px] text-text-tertiary">
        {copy.subtitle}
      </p>
      <div className="mt-3 divide-y divide-border-primary">
        {movers.map((cell, index) => (
          <div
            key={cell.instrumentId}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2 text-xs"
          >
            <span className="font-mono text-text-tertiary">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-semibold text-text-primary">
              {cell.nameJa}
            </span>
            <span
              className={`font-mono font-bold ${marketDirectionClass(cell.direction)}`}
            >
              {cell.changeLabel}
            </span>
          </div>
        ))}
      </div>
      <WindowProvenanceRow provenance={provenance} labels={copy.provenance} />
    </section>
  );
}
