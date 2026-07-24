import type { LaneId } from "@/lib/home/instruments";
import { marketDirectionClass } from "@/lib/home/market-direction";
import type { MarketSnapshotCell } from "@/lib/home/market-snapshot";
import type { WindowProvenance } from "@/lib/provenance/window-provenance";
import {
  WindowProvenanceRow,
  type ProvenanceLabels,
} from "./WindowProvenanceRow";

export interface LaneValuesCopy {
  title: string;
  laneLabels: Record<LaneId, string>;
  provenance: ProvenanceLabels;
}

const LANES: readonly LaneId[] = ["macro", "crypto", "rwa"];

/**
 * 中央カラム⑤ レーン補完値 (G44 D6)。MACRO/CRYPTO/RWA の値セルのみを示し、記事リンクは
 * 持たない。per-lane provenance を保つため各レーンを data-lane で括り、レーン別に
 * WindowProvenanceRow (data-packet-id) を出す (gate 7 の per-lane packet 整合)。
 */
export function LaneValuesCard({
  laneCells,
  laneProvenance,
  copy,
}: {
  laneCells: Record<LaneId, MarketSnapshotCell[]>;
  laneProvenance: Record<LaneId, WindowProvenance>;
  copy: LaneValuesCopy;
}) {
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <div className="mt-3 space-y-4">
        {LANES.map((lane) => (
          <div key={lane} data-lane={lane}>
            <h4 className="text-[11px] font-bold tracking-label text-text-secondary">
              {copy.laneLabels[lane]}
            </h4>
            <div className="mt-1 divide-y divide-border-primary">
              {laneCells[lane].map((cell) => (
                <div
                  key={cell.instrumentId}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1.5 text-xs"
                >
                  <span className="font-semibold text-text-secondary">
                    {cell.nameJa}
                  </span>
                  <span className="font-mono font-bold text-text-primary">
                    {cell.value ?? "—"}
                  </span>
                  <span
                    className={`min-w-14 text-right font-mono text-[10px] ${marketDirectionClass(cell.direction)}`}
                  >
                    {cell.changeLabel ?? "—"}
                  </span>
                </div>
              ))}
            </div>
            <WindowProvenanceRow
              provenance={laneProvenance[lane]}
              labels={copy.provenance}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
