import { getAllBriefs } from "@/lib/briefs";
import { stripMarkdown, truncate } from "@/lib/brief-metadata";
import type { TerminalArticleNewsFeedItem } from "@/lib/livemakers-terminal-preview/types";

/**
 * G39-B B4: the Published Intelligence window's PRIMARY feed is site-native —
 * the livemakers.com Weekly Briefs enumerated from disk at request time, so a
 * newly published brief appears without editing a fixture. The X-published
 * secondary feed is separate (see live-market-feed.ts `published`) because the
 * public-topology validator forbids external urls in `articleNewsFeed`.
 *
 * Each item is shaped exactly like the reviewed fixture's articleNewsFeed
 * items, and every href is an internal `/brief/{slug}` route — the shape the
 * unmodified public-topology validator already accepts, so wiring the live
 * feed keeps that validator green.
 */

const FEED_LIMIT = 5;
const EXCERPT_MAX_EN = 140;
const EXCERPT_MAX_JA = 90;

/**
 * All Weekly Briefs carry the "Weekly Brief" family badge. If per-issue
 * families are wanted later (Deep Dive / Next Era Map / …), add an optional
 * field to the brief meta and read it here — an editorial follow-up, not a
 * code change to the wiring.
 */
const BRIEF_FAMILY = "Weekly Brief" as const;

export interface SiteNativePublishedFeed {
  title: { en: string; ja: string };
  items: TerminalArticleNewsFeedItem[];
}

/**
 * Build the site-native published feed from the on-disk briefs. Returns null
 * when there are no briefs, so the caller keeps the reviewed fixture rather
 * than rendering an empty window.
 */
export function buildSiteNativePublishedFeed(): SiteNativePublishedFeed | null {
  const briefs = getAllBriefs();
  if (briefs.length === 0) return null;

  const items: TerminalArticleNewsFeedItem[] = briefs
    .slice(0, FEED_LIMIT)
    .map((brief) => ({
      id: `feed.brief.${brief.slug}`,
      family: BRIEF_FAMILY,
      title: { en: brief.title_en, ja: brief.title_ja },
      href: `/brief/${brief.slug}`,
      publishedAt: brief.published_at,
      excerpt: {
        en: truncate(stripMarkdown(brief.executive_summary_en), EXCERPT_MAX_EN),
        ja: truncate(stripMarkdown(brief.executive_summary_ja), EXCERPT_MAX_JA),
      },
    }));

  return {
    title: { en: "Published Intelligence", ja: "公開済みインテリジェンス" },
    items,
  };
}
