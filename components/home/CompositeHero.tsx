import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import {
  REGION_MODULES,
  type GradientRegion,
} from "@/lib/home/gradient-ledger";
import type { HomeCopy } from "@/lib/home/home-copy";
import type { HomeSlots } from "@/lib/home/select-home-slots";
import type { SessionRecord } from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import { FAMILY_COLORS } from "./ArticleRow";
import {
  firstLeadSentences,
  type SessionNowCopy,
} from "./SessionNowCard";

const REGION = "hero" satisfies GradientRegion;

/**
 * Mobile composite hero (G44 D8). Below xl this is the only representation of
 * the current session and the Daily Intel lead — the leading column's
 * session-now and the coincident column's lead-article are `hidden xl:block`,
 * so no DOM duplication exists at any breakpoint.
 *
 * Contract: every link is index navigation (`data-index-nav`) and the hero
 * never carries `data-article-id` (gate 6 / D14 hero partition).
 */
export function CompositeHero({
  live,
  recentClosed = null,
  lead,
  copy,
  editorialCopy,
  showSessionEditorial = true,
}: {
  live: SessionRecord | null;
  /**
   * 2026-08-23 田平氏 GO (spec 2026-08-23-terminal-switching-ux-design §A):
   * live が無い窓は「直前に終わったセッション」を終了として見せる (desktop の
   * SessionNowCard closed variant と同じ扱い・mobile はこの hero が唯一の表現)。
   */
  recentClosed?: SessionRecord | null;
  lead: HomeSlots["lead"];
  copy: HomeCopy["hero"];
  editorialCopy?: SessionNowCopy;
  showSessionEditorial?: boolean;
}) {
  const renderModule = (module: string): ReactNode => {
    switch (module) {
      case "hero-session-line": {
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
      case "hero-lead-headline":
        return lead.article ? (
          <Link
            href={lead.article.href}
            data-index-nav
            className="block rounded-lg border border-border-primary bg-bg-secondary p-4"
          >
            <span
              className="text-[10px] font-bold tracking-label"
              style={{ color: FAMILY_COLORS["daily-intel"] }}
            >
              {copy.leadFamily}
            </span>
            <span className="mt-1 block text-base font-bold leading-snug text-text-primary">
              {lead.article.titleJa}
            </span>
          </Link>
        ) : (
          <p className="rounded-lg border border-border-primary bg-bg-secondary p-4 text-sm text-text-tertiary">
            {copy.leadPending}
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <section data-ledger-group={REGION} className="space-y-3 xl:hidden">
      {REGION_MODULES[REGION].map((module) => (
        <div key={module} data-column-module={module}>
          {renderModule(module)}
        </div>
      ))}
    </section>
  );
}
