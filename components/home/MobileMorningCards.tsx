import { ArticleThumbnail } from "@/components/articles/ArticleThumbnail";
import { Link } from "@/i18n/navigation";
import type { HomeCopy } from "@/lib/home/home-copy";
import type { HomeSlots } from "@/lib/home/select-home-slots";
import { FAMILY_COLORS } from "./ArticleRow";
import { ArticleThumbRow } from "./ArticleThumbRow";
import { mkt12ReadingText } from "./mkt12-reading-text";

/**
 * スマホの Daily Intel 大カード + 今朝の12指標 小カード (G44 D8 の単一表現)。
 * 2026-10-26 田平氏 GO: Intelligence Terminal (セッションカード + 本日の更新予定) の
 * 下に置く (leading の lead-card-mobile / mkt12-card-mobile・xl:hidden)。中央列の
 * lead-article / mkt12-reading は `hidden xl:block` なので、同じ記事はどの幅でも
 * 1 回しか見えない。12指標はアーカイブリンクを行の下に置く (右隣に並べると
 * スマホ幅で行が押し縮められる)。
 *
 * Contract: every link is index navigation (`data-index-nav`) and neither card
 * carries `data-article-id` (gate 6 — the desktop desks own the body ids).
 */
type MobileCardCopy = Pick<HomeCopy, "hero" | "mkt12" | "familyLabels">;

export function MobileLeadCard({
  lead,
  copy,
}: {
  lead: HomeSlots["lead"];
  copy: MobileCardCopy;
}) {
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
}

export function MobileMkt12Card({
  mkt12,
  copy,
}: {
  mkt12: HomeSlots["mkt12"];
  copy: MobileCardCopy;
}) {
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
