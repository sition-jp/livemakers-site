import { Link } from "@/i18n/navigation";
import { INSTRUMENT_DISPLAY_NAMES_JA } from "@/lib/home/instruments";
import type { getTodaySchedule } from "@/lib/sessions/session-content";

export interface SessionScheduleCopy {
  title: string;
  /** "{date}" を前回セッションの M/D に置き換えて使う (2026-10-09 GO) */
  previous: string;
  /** いま配信中の行 (isCurrent) のリンク文言 (2026-10-09 GO) */
  live: string;
  archive: string;
  compactBadge: string;
  compactPrevious: string;
  focusPrefix: string;
}

type Schedule = ReturnType<typeof getTodaySchedule>;

/** "2026-10-08" → "10/8" (ゼロ埋めなし) */
function monthDayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

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
        {schedule.map(({ def, isCurrent, current, previous }) => {
          const focusPreview = def.defaultFocusInstruments
            .map((instrumentId) => INSTRUMENT_DISPLAY_NAMES_JA[instrumentId])
            .join(" · ");
          return (
            <div
              key={def.slug}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded px-2 py-2 text-xs ${
                isCurrent ? "bg-bg-tertiary" : ""
              }`}
            >
              <span className="font-mono text-text-tertiary">
                {def.updateTimeLabel}
              </span>
              <span className="min-w-0">
                <span className="font-semibold text-text-primary">
                  {def.nameEn}
                </span>
                <span className="block truncate text-[10px] text-text-tertiary">
                  {copy.focusPrefix} {focusPreview}
                </span>
              </span>
              {current ? (
                <Link
                  href={current.currentUrl}
                  className="font-bold text-accent"
                >
                  {copy.live}
                </Link>
              ) : previous ? (
                <Link
                  href={previous.currentUrl}
                  className="font-bold text-accent"
                >
                  {copy.previous.replace(
                    "{date}",
                    monthDayLabel(previous.date),
                  )}
                </Link>
              ) : null}
            </div>
          );
        })}
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
