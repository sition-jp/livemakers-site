import { Link } from "@/i18n/navigation";
import {
  SERIES_SLUGS,
  type SeriesSlug,
} from "@/lib/articles/article-model";

export interface SeriesIndexCopy {
  title: string;
  subtitle: string;
  listLabel: string;
  familyLabels: Record<SeriesSlug, string>;
}

export function SeriesIndexCard({ copy }: { copy: SeriesIndexCopy }) {
  return (
    <section
      data-index-nav
      className="flex h-full flex-col rounded-lg border border-border-primary bg-bg-secondary p-4"
    >
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <p className="mt-1 text-[11px] text-text-tertiary">
        {copy.subtitle}
      </p>
      <div data-series-index-list className="mt-3 grid flex-1 grid-cols-1 gap-1">
        {SERIES_SLUGS.map((series) => (
          <Link
            key={series}
            href={`/articles/series/${series}`}
            className="flex items-center gap-2 border-b border-dashed border-border-primary px-1 py-2 text-xs text-text-primary hover:text-accent"
          >
            <span className="font-semibold">{copy.familyLabels[series]}</span>
            <span className="ml-auto font-bold text-accent">
              {copy.listLabel}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
