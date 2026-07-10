import type {
  RadarLane,
  RadarObservation,
} from "@/lib/home/radar-observations";

export interface RadarPromotedCopy {
  title: string;
  subtitle: string;
  observedSuffix: string;
  publishedSuffix: string;
  laneLabels: Record<RadarLane, string>;
}

export function RadarPromotedCard({
  observation,
  publishedLabel,
  copy,
}: {
  observation: RadarObservation;
  publishedLabel: string;
  copy: RadarPromotedCopy;
}) {
  const promotionNote = `${observation.observedAtLabel} ${copy.observedSuffix}${publishedLabel} ${copy.publishedSuffix}`;
  return (
    <section
      data-radar
      className="rounded-lg border border-radar-line bg-radar-bg p-4"
    >
      <h3 className="text-sm font-bold text-radar-ink">{copy.title}</h3>
      <p className="mt-1 text-[11px] text-radar-sub">
        {copy.subtitle}
      </p>
      <div className="mt-3 border-y border-dashed border-radar-line py-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-bg-tertiary px-2 py-0.5 text-[9px] font-bold text-text-secondary">
            {copy.laneLabels[observation.lane]}
          </span>
          <time className="ml-auto font-mono text-[10px] text-radar-sub">
            {observation.observedAtLabel}
          </time>
        </div>
        <p className="mt-2 text-sm font-semibold leading-snug text-radar-ink">
          {observation.titleJa}
        </p>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-radar-sub">
        {promotionNote}
      </p>
    </section>
  );
}
