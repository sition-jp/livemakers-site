import type { WindowProvenance } from "@/lib/provenance/window-provenance";

export interface ProvenanceLabels {
  review: string;
  source: string;
  asOf: string;
  packet: string;
}

export function WindowProvenanceRow({
  provenance,
  labels,
}: {
  provenance: WindowProvenance;
  labels: ProvenanceLabels;
}) {
  return (
    <div
      data-packet-id={provenance.packetId}
      className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-dashed border-border-primary pt-1.5 text-[9.5px] text-text-tertiary"
    >
      <span>
        {labels.review}: <b className="font-semibold text-text-secondary">{provenance.reviewStatus}</b>
      </span>
      <span>
        {labels.source}: <b className="font-semibold text-text-secondary">{provenance.sourceMode}</b>
      </span>
      <span>
        {labels.asOf} <b className="font-mono">{provenance.asOfJst}</b>
      </span>
      <span>
        {labels.packet}: <b className="font-mono">{provenance.packetId}</b>
      </span>
    </div>
  );
}
