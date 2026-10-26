import type { ReactNode } from "react";

import { ArticleThumbnail } from "@/components/articles/ArticleThumbnail";
import { Link } from "@/i18n/navigation";
import {
  REGION_MODULES,
  type GradientRegion,
} from "@/lib/home/gradient-ledger";
import type { HomeCopy } from "@/lib/home/home-copy";
import type { HomeSlots } from "@/lib/home/select-home-slots";
import { FAMILY_COLORS } from "./ArticleRow";
import { ArticleThumbRow } from "./ArticleThumbRow";
import { mkt12ReadingText } from "./mkt12-reading-text";

const REGION = "hero" satisfies GradientRegion;

/**
 * Mobile composite hero (G44 D8). Below xl this is the only representation of
 * the Daily Intel lead and this morning's 12 indicators — the coincident
 * column's lead-article and mkt12-reading are `hidden xl:block`, so the same
 * article is never shown twice at any breakpoint.
 *
 * 2026-10-26 田平氏 GO (スマホの並び): Daily Intel = サムネ付きの大きなカード、
 * 12指標 = 小サムネの行の小さなカード (アーカイブリンクは行の下)。セッション 1 行は
 * Intelligence Terminal の見出しの下 (leading の session-line) へ移した。
 *
 * Contract: every link is index navigation (`data-index-nav`) and the hero
 * never carries `data-article-id` (gate 6 / D14 hero partition).
 */
export function CompositeHero({
  lead,
  mkt12,
  copy,
}: {
  lead: HomeSlots["lead"];
  mkt12: HomeSlots["mkt12"];
  copy: Pick<HomeCopy, "hero" | "mkt12" | "familyLabels">;
}) {
  const renderModule = (module: string): ReactNode => {
    switch (module) {
      case "hero-lead-card":
        return lead.article ? (
          <Link
            href={lead.article.href}
            data-index-nav
            className="group block overflow-hidden rounded-lg border border-border-primary bg-bg-secondary"
          >
            <ArticleThumbnail
              thumbnailUrl={lead.article.thumbnailUrl}
              family={lead.article.family}
              title={lead.article.titleJa}
              variant="fixed"
            />
            <span className="block p-4">
              <span className="flex items-baseline justify-between gap-3">
                <span
                  className="text-[10px] font-bold tracking-label"
                  style={{ color: FAMILY_COLORS["daily-intel"] }}
                >
                  {copy.hero.leadFamily}
                </span>
                <time
                  dateTime={lead.article.publishedAtJst}
                  className="whitespace-nowrap font-mono text-[10px] text-text-tertiary"
                >
                  {lead.article.publishedLabel}
                </time>
              </span>
              <span className="mt-1 block text-base font-bold leading-snug text-text-primary group-hover:underline">
                {lead.article.titleJa}
              </span>
            </span>
          </Link>
        ) : (
          <p className="rounded-lg border border-border-primary bg-bg-secondary p-4 text-sm text-text-tertiary">
            {copy.hero.leadPending}
          </p>
        );
      case "hero-mkt12-card": {
        const text = mkt12ReadingText(mkt12.variant, copy.mkt12);
        return (
          <section
            data-mkt12-variant={mkt12.variant}
            className="rounded-lg border border-border-primary bg-bg-secondary p-4"
          >
            <h3 className="text-sm font-bold text-text-primary">{text.title}</h3>
            <div className="mt-2 border-t border-border-primary">
              {mkt12.article ? (
                <ArticleThumbRow
                  article={mkt12.article}
                  familyLabel={copy.familyLabels[mkt12.article.family]}
                  indexNav
                  trackArticleId={false}
                />
              ) : (
                <div className="mt-2 rounded bg-bg-tertiary p-3 text-xs text-text-secondary">
                  <p>{text.awaiting}</p>
                  {mkt12.previous ? (
                    <div data-index-nav className="mt-2">
                      <Link
                        href={mkt12.previous.href}
                        className="font-bold text-accent"
                      >
                        {text.previous}
                      </Link>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            {/* 行の下・右寄せ — 右隣に並べるとスマホ幅で行が押し縮められる */}
            <div data-index-nav className="mt-2 text-right">
              <Link
                href={text.archiveHref}
                className="text-xs font-bold text-accent"
              >
                {copy.mkt12.archiveLink}
              </Link>
            </div>
          </section>
        );
      }
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
