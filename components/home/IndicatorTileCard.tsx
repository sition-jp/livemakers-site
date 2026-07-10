import type { MarketSnapshotCell } from "@/lib/home/market-snapshot";
import type { WindowProvenance } from "@/lib/provenance/window-provenance";
import {
  WindowProvenanceRow,
  type ProvenanceLabels,
} from "./WindowProvenanceRow";

export interface IndicatorTileCopy {
  title: string;
  dataDatePrefix: string;
  snapshotBadge: string;
  scrollHint: string;
  regimeLabel: string;
  provenance: ProvenanceLabels;
}

export function IndicatorTileCard({
  cells,
  dataDate,
  asOfLabel,
  regimeNoteJa,
  provenance,
  copy,
}: {
  cells: MarketSnapshotCell[];
  dataDate: string;
  asOfLabel: string;
  regimeNoteJa?: string;
  provenance: WindowProvenance;
  copy: IndicatorTileCopy;
}) {
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
        <span className="text-[10px] text-text-tertiary">
          {copy.dataDatePrefix} {dataDate}
        </span>
        <span className="ml-auto rounded bg-bg-tertiary px-2 py-0.5 font-mono text-[9px] font-bold text-text-secondary">
          {copy.snapshotBadge} {asOfLabel}
        </span>
      </div>
      <p className="mt-2 text-[10px] text-text-tertiary md:hidden">
        {copy.scrollHint}
      </p>
      <div className="mt-3 overflow-x-auto">
        <div className="grid min-w-[660px] grid-cols-4 gap-px overflow-hidden rounded border border-border-primary bg-border-primary md:min-w-0">
          {cells.map((cell) => (
            <div
              key={cell.instrumentId}
              className="bg-bg-primary px-3 py-2.5"
            >
              <p className="truncate text-[10px] font-semibold text-text-tertiary">
                {cell.nameJa}
              </p>
              <p className="mt-1 font-mono text-sm font-bold text-text-primary">
                {cell.value ?? "—"}
              </p>
              {cell.changeLabel ? (
                <p
                  className={`mt-0.5 font-mono text-[10px] ${
                    cell.up ? "text-status-up" : "text-status-down"
                  }`}
                >
                  {cell.changeLabel}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {regimeNoteJa ? (
        <p className="mt-3 rounded bg-bg-tertiary px-3 py-2 text-xs text-text-secondary">
          <b className="mr-2 text-text-primary">{copy.regimeLabel}</b>
          {regimeNoteJa}
        </p>
      ) : null}
      <WindowProvenanceRow provenance={provenance} labels={copy.provenance} />
    </section>
  );
}
