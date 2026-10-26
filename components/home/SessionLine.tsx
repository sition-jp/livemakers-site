import { Link } from "@/i18n/navigation";
import type { HomeCopy } from "@/lib/home/home-copy";
import type { SessionRecord } from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import {
  firstLeadSentences,
  type SessionNowCopy,
} from "./SessionNowCard";

/**
 * Mobile session line (G44 D8). Below xl this is the only representation of the
 * current session — the leading column's session-now card is `hidden xl:block`.
 * 2026-10-26 田平氏 GO: moved from the composite hero to the top of the
 * Intelligence Terminal column (leading `session-line`) so the session sits
 * under its own heading instead of above the Daily Intel card.
 *
 * Contract: the link is index navigation (`data-index-nav`) and never carries
 * `data-article-id`.
 */
export function SessionLine({
  live,
  recentClosed = null,
  copy,
  editorialCopy,
  showSessionEditorial = true,
}: {
  live: SessionRecord | null;
  /**
   * 2026-08-23 田平氏 GO (spec 2026-08-23-terminal-switching-ux-design §A):
   * live が無い窓は「直前に終わったセッション」を終了として見せる (desktop の
   * SessionNowCard closed variant と同じ扱い・mobile はこの行が唯一の表現)。
   */
  recentClosed?: SessionRecord | null;
  copy: HomeCopy["hero"];
  editorialCopy?: SessionNowCopy;
  showSessionEditorial?: boolean;
}) {
  const shown = live ?? recentClosed;
  const isClosed = !live && recentClosed !== null;
  const sessionName = shown
    ? getSessionBySlug(shown.sessionSlug).nameJa
    : copy.sessionFallback;
  const editorial =
    showSessionEditorial && editorialCopy ? shown?.editorial : undefined;
  // 2026-08-23 (田平氏 GO): the CTA always targets the session's own
  // URL — same retirement of the D6 archive detour as SessionNowCard
  // (app/[locale]/sessions/[slug] resolves feed-origin records through
  // resolveSessionPageRecord, so a record shown here can never 404 at
  // currentUrl while it is in the feed; the archive detour landed
  // readers on a stale list). No session at all → archive.
  const sessionHref = shown ? shown.currentUrl : "/sessions/archive";
  return (
    <Link
      href={sessionHref}
      data-index-nav
      data-session-state={live ? "live" : isClosed ? "closed" : "none"}
      className="block rounded-lg border border-border-primary border-l-4 border-l-accent bg-bg-secondary px-4 py-3"
    >
      <span className="flex items-baseline gap-2">
        <span className="shrink-0 text-[10px] font-bold tracking-label text-text-tertiary">
          {isClosed ? copy.closedSessionLabel : copy.sessionLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-text-primary">
          {sessionName}
        </span>
        {shown ? (
          <span className="shrink-0 font-mono text-[10px] text-text-tertiary">
            {shown.date} · {shown.asOfJst.slice(11, 16)} JST
            {isClosed ? ` · ${copy.closedSuffix}` : ""}
            {shown.observationStatus === "absent"
              ? ` · ${copy.digestOnlyLabel}`
              : ""}
          </span>
        ) : null}
      </span>
      {editorial && editorialCopy ? (
        <>
          <span className="mt-2 block text-xs leading-relaxed text-text-secondary">
            {firstLeadSentences(editorial.lead)}
          </span>
          <span className="mt-2 block text-right text-xs font-bold text-accent">
            {editorialCopy.editorialPrefix} {editorial.items.length}{" "}
            {editorialCopy.editorialSuffix}
          </span>
        </>
      ) : null}
    </Link>
  );
}
