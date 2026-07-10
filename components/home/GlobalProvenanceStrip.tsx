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
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border-primary bg-bg-secondary px-4 py-1.5 text-[10.5px] text-text-tertiary md:px-8"
    >
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
  );
}
