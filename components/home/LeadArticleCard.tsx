import { Link } from "@/i18n/navigation";
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
}: {
  slot: HomeSlots["lead"];
  labels: LeadArticleLabels;
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
  return (
    <Link
      href={article.href}
      data-article-id={article.articleId}
      className="group block overflow-hidden rounded-lg border border-border-primary bg-bg-secondary transition-colors hover:border-border-hover"
    >
      <div
        className="h-24 opacity-80"
        style={{
          background: `linear-gradient(120deg, ${FAMILY_COLORS[article.family]}, transparent)`,
        }}
      />
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className="text-[10px] font-bold tracking-label"
            style={{ color: FAMILY_COLORS[article.family] }}
          >
            {labels.family}
          </span>
          <time className="font-mono text-[10px] text-text-tertiary">
            {article.publishedLabel}
          </time>
        </div>
        <h2 className="mt-3 text-xl font-bold leading-snug text-text-primary group-hover:underline">
          {article.titleJa}
        </h2>
        {article.excerptJa ? (
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {article.excerptJa}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
