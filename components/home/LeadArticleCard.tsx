import { Link } from "@/i18n/navigation";
import { ArticleThumbnail } from "@/components/articles/ArticleThumbnail";
import type { HomeSlots } from "@/lib/home/select-home-slots";
import { FAMILY_COLORS } from "./ArticleRow";

export interface LeadArticleLabels {
  pending: string;
  pendingNote: string;
  previous: string;
  family: string;
}

export function LeadArticleCard({
  slot,
  labels,
  headingLevel = "h2",
  variant = "full",
}: {
  slot: HomeSlots["lead"];
  labels: LeadArticleLabels;
  headingLevel?: "h2" | "h4";
  /**
   * "full" = 現行 (14:3 サムネ + family ラベル + text-xl 見出し + 抜粋・p-5)。
   * "compact" (2026-08-23 GO B-1) = 「Daily Intel」帯用。family ラベル行と
   * 抜粋を描かず、日時 + text-lg 見出しのみ・p-4。帯ヘッダが家族名を担う。
   */
  variant?: "full" | "compact";
}) {
  if (!slot.article) {
    return (
      <section className="rounded-lg border border-border-primary bg-bg-secondary p-5">
        <span className="inline-flex rounded bg-bg-tertiary px-2 py-1 text-[10px] font-bold text-text-secondary">
          {labels.pending}
        </span>
        <p className="mt-3 text-sm text-text-tertiary">
          {labels.pendingNote}
        </p>
        {slot.previous ? (
          <div data-index-nav className="mt-4">
            <Link
              href={slot.previous.href}
              className="text-sm font-bold text-accent"
            >
              {labels.previous}
            </Link>
          </div>
        ) : null}
      </section>
    );
  }

  const article = slot.article;
  const Heading = headingLevel;
  const compact = variant === "compact";
  return (
    <Link
      href={article.href}
      data-article-id={article.articleId}
      data-lead-variant={variant}
      className="group block overflow-hidden rounded-lg border border-border-primary bg-bg-secondary transition-colors hover:border-border-hover"
    >
      <ArticleThumbnail
        thumbnailUrl={article.thumbnailUrl}
        family={article.family}
        title={article.titleJa}
        variant="lead"
      />
      <div className={compact ? "p-4" : "p-5"}>
        <div className="flex items-center justify-between gap-3">
          {compact ? (
            <span />
          ) : (
            <span
              className="text-[10px] font-bold tracking-label"
              style={{ color: FAMILY_COLORS[article.family] }}
            >
              {labels.family}
            </span>
          )}
          <time className="font-mono text-[10px] text-text-tertiary">
            {article.publishedLabel}
          </time>
        </div>
        <Heading
          className={`${compact ? "mt-2 text-lg" : "mt-3 text-xl"} font-bold leading-snug text-text-primary group-hover:underline`}
        >
          {article.titleJa}
        </Heading>
        {!compact && article.excerptJa ? (
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {article.excerptJa}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
