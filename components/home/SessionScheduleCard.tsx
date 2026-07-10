import { Link } from "@/i18n/navigation";
import type { getTodaySchedule } from "@/lib/sessions/session-content";

export interface SessionScheduleCopy {
  title: string;
  previous: string;
  archive: string;
  compactBadge: string;
  compactPrevious: string;
}

type Schedule = ReturnType<typeof getTodaySchedule>;

export function SessionScheduleCard({
  schedule,
  copy,
  variant = "full",
}: {
  schedule: Schedule;
  copy: SessionScheduleCopy;
  variant?: "full" | "compact";
}) {
  const remaining = schedule.filter((item) => !item.isCurrent);
  const firstPrevious = remaining.find((item) => item.previous)?.previous;

  if (variant === "compact") {
    return (
      <div
        data-index-nav
        className="flex items-center gap-3 rounded border border-border-primary bg-bg-secondary px-3 py-2"
      >
        <span className="rounded bg-bg-tertiary px-2 py-1 text-[10px] font-bold text-text-secondary">
          {copy.compactBadge}
        </span>
        <Link
          href={firstPrevious?.currentUrl ?? "/sessions/archive"}
          className="ml-auto text-xs font-bold text-accent"
        >
          {copy.compactPrevious}
        </Link>
      </div>
    );
  }

  return (
    <section
      data-index-nav
      className="rounded-lg border border-border-primary bg-bg-secondary p-4"
    >
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <div className="mt-2 divide-y divide-border-primary">
        {remaining.map(({ def, previous }) => (
          <div
            key={def.slug}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2 text-xs"
          >
            <span className="font-mono text-text-tertiary">
              {def.updateTimeLabel}
            </span>
            <span className="font-semibold text-text-primary">
              {def.nameEn}
            </span>
            {previous ? (
              <Link
                href={previous.currentUrl}
                className="font-bold text-accent"
              >
                {copy.previous}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
      <Link
        href="/sessions/archive"
        className="mt-2 block border-t border-dashed border-border-primary pt-3 text-xs font-bold text-accent"
      >
        {copy.archive}
      </Link>
    </section>
  );
}
