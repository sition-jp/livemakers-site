import { Link } from "@/i18n/navigation";
import {
  formatSessionTimestamp,
  type SessionRecord,
} from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";

/**
 * Intelligence Terminal セッション記事の一覧行 (2026-08-14 Phase 3b)。
 * /sessions/archive (直近 1 週間) と /sessions/archive/past (全記録) で共用。
 */
export function SessionArchiveList({
  records,
  familyLabel,
}: {
  records: readonly SessionRecord[];
  familyLabel: string;
}) {
  return (
    <div className="border-t border-border-primary">
      {records.map((record) => {
        const definition = getSessionBySlug(record.sessionSlug);
        return (
          <Link
            key={record.sessionId}
            href={record.currentUrl}
            data-article-id={record.sessionId}
            className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border-primary px-3 py-3 transition-colors hover:bg-bg-tertiary"
          >
            <span className="rounded-sm border border-accent px-1.5 py-0.5 text-[9px] font-bold tracking-label text-accent">
              {familyLabel}
            </span>
            <span className="min-w-0 text-sm font-semibold text-text-primary group-hover:underline">
              {definition.nameEn} {record.date}
            </span>
            <time
              dateTime={record.publishedAt ?? undefined}
              className="whitespace-nowrap font-mono text-[10px] text-text-tertiary"
            >
              {formatSessionTimestamp(record.publishedAt)}
            </time>
          </Link>
        );
      })}
    </div>
  );
}
