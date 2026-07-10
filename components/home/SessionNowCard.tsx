import { Link } from "@/i18n/navigation";
import type { SessionRecord } from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import type { WindowProvenance } from "@/lib/provenance/window-provenance";
import {
  WindowProvenanceRow,
  type ProvenanceLabels,
} from "./WindowProvenanceRow";

export interface SessionNowCopy {
  sessionBadgeSuffix: string;
  nextUpdateLine: string;
  readFull: string;
  provenance: ProvenanceLabels;
}

export function SessionNowCard({
  record,
  provenance,
  copy,
}: {
  record: SessionRecord;
  provenance: WindowProvenance;
  copy: SessionNowCopy;
}) {
  const definition = getSessionBySlug(record.sessionSlug);
  return (
    <section
      aria-label={definition.nameEn}
      className="rounded-lg border border-border-primary border-l-4 border-l-accent bg-bg-secondary p-4"
    >
      <div className="flex items-center gap-2.5">
        <h3 className="text-base font-bold text-text-primary">
          {definition.nameEn}
        </h3>
        <span className="ml-auto rounded bg-accent px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white">
          SESSION · {definition.updateTimeLabel} {copy.sessionBadgeSuffix}
        </span>
      </div>
      <ul className="mt-2 text-[13px] text-text-primary">
        {record.bullets.map((bullet, index) => (
          <li
            key={bullet}
            className={`border-b border-dashed border-border-primary py-1.5 last:border-b-0 ${
              index >= 2 ? "hidden md:list-item" : ""
            }`}
          >
            {bullet}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-3 text-[11.5px] text-text-tertiary">
        <span>{copy.nextUpdateLine}</span>
        <Link
          href={record.currentUrl}
          className="ml-auto shrink-0 text-[12.5px] font-bold text-accent"
        >
          {copy.readFull}
        </Link>
      </div>
      <WindowProvenanceRow
        provenance={provenance}
        labels={copy.provenance}
      />
    </section>
  );
}
