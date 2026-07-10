import type { WindowProvenance } from "@/lib/provenance/window-provenance";
import type { ProvenanceLabels } from "./WindowProvenanceRow";

export function GlobalProvenanceStrip({
  provenance,
  labels,
  note,
}: {
  provenance: WindowProvenance;
  labels: ProvenanceLabels;
  note: string;
}) {
  return (
    <div
      data-chrome="provenance-strip"
      data-packet-id={provenance.packetId}
      className="border-b border-border-primary bg-bg-secondary text-[10.5px] text-text-tertiary"
    >
      {/* Same centered container as Header/TickerBar/Footer so the strip's
          edges align with the site chrome on wide viewports. */}
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
        <span>
          {labels.review}: <b className="font-bold text-text-primary">{provenance.reviewStatus}</b>
        </span>
        <span>
          {labels.source}: <b className="font-bold text-text-primary">{provenance.sourceMode}</b>
        </span>
        <span>
          {labels.asOf} <b className="font-mono">{provenance.asOfJst}</b>
        </span>
        <span>
          {labels.packet}: <b className="font-mono">{provenance.packetId}</b>
        </span>
        <span className="ml-auto">{note}</span>
      </div>
    </div>
  );
}
