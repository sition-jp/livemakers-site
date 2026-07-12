import type { FocusSeries } from "@/lib/sessions/focus-series";
import { INSTRUMENT_DISPLAY_NAMES_JA } from "@/lib/home/instruments";
import {
  makeWindowProvenance,
  type WindowProvenance,
} from "@/lib/provenance/window-provenance";
import {
  WindowProvenanceRow,
  type ProvenanceLabels,
} from "./WindowProvenanceRow";

export interface SessionFocusCopy {
  title: string;
  snapshotBadge: string;
  basePrefix: string;
  description: string;
  provenance: ProvenanceLabels;
}

function sparklinePoints(series: FocusSeries): string {
  const width = 160;
  const height = 32;
  const values = series.points.map((point) => point.value);
  const min = Math.min(...values);
  const range = Math.max(Math.max(...values) - min, Number.EPSILON);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function SessionFocusChart({
  sessionName,
  series,
  unavailableLabel,
  copy,
}: {
  sessionName: string;
  series: (FocusSeries | null)[];
  unavailableLabel: string;
  copy: SessionFocusCopy;
}) {
  return (
    <section
      aria-label={`${copy.title}: ${sessionName}`}
      className="rounded-lg border border-border-primary bg-bg-secondary p-4"
    >
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
        <span className="ml-auto rounded bg-bg-tertiary px-2 py-0.5 font-mono text-[9px] font-bold text-text-secondary">
          {copy.snapshotBadge}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-text-tertiary">
        {copy.description}
      </p>
      <div className="mt-3 space-y-3">
        {series.map((item, index) =>
          item ? (
            <div key={item.instrumentId}>
              <div className="grid grid-cols-[minmax(0,1fr)_160px_auto] items-center gap-3">
                <span
                  data-focus-instrument-label
                  className="truncate text-[11px] font-semibold text-text-secondary"
                >
                  {INSTRUMENT_DISPLAY_NAMES_JA[item.instrumentId]}
                </span>
                <svg
                  role="img"
                  aria-hidden="true"
                  viewBox="0 0 160 32"
                  className="h-8 w-40"
                >
                  <polyline
                    points={sparklinePoints(item)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-accent"
                  />
                </svg>
                <span className="text-right font-mono text-[11px] text-text-primary">
                  <b>{item.lastValue.toLocaleString()}</b>
                  <br />
                  <span
                    className={
                      item.changeFromBasePct >= 0
                        ? "text-status-up"
                        : "text-status-down"
                    }
                  >
                    {item.changeFromBasePct >= 0 ? "+" : ""}
                    {item.changeFromBasePct.toFixed(2)}%
                  </span>
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-text-tertiary">
                {copy.basePrefix} {item.baseValue.toLocaleString()} →{" "}
                {item.lastValue.toLocaleString()}
              </div>
              <WindowProvenanceRow
                provenance={makeWindowProvenance({
                  packetId: item.seriesPacketId,
                  sourceMode: item.sourceMode,
                  reviewStatus: item.reviewStatus,
                  asOfJst: item.points.at(-1)!.atJst,
                } as WindowProvenance)}
                labels={copy.provenance}
              />
            </div>
          ) : (
            <div
              key={`unavailable-${index}`}
              className="border-b border-dashed border-border-primary py-2 font-mono text-sm text-text-tertiary"
            >
              {unavailableLabel}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
