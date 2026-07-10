import type {
  RadarLane,
  RadarObservation,
} from "@/lib/home/radar-observations";

export interface RadarObservationsCopy {
  title: string;
  note: string;
  laneLabels: Record<RadarLane, string>;
}

export function RadarObservationsCard({
  observations,
  copy,
}: {
  observations: readonly RadarObservation[];
  copy: RadarObservationsCopy;
}) {
  return (
    <section
      data-radar
      className="rounded-lg border border-border-primary bg-bg-secondary p-4"
    >
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <div className="mt-3 divide-y divide-dashed divide-border-primary">
        {observations.map((observation) => (
          <div key={observation.topicId} className="py-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-bg-tertiary px-2 py-0.5 text-[9px] font-bold text-text-secondary">
                {copy.laneLabels[observation.lane]}
              </span>
              <time className="ml-auto font-mono text-[10px] text-text-tertiary">
                {observation.observedAtLabel}
              </time>
            </div>
            <p className="mt-1.5 text-[13px] font-semibold leading-snug text-text-primary">
              {observation.titleJa}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-text-tertiary">{copy.note}</p>
    </section>
  );
}
