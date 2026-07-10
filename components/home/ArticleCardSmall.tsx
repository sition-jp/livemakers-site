import { Link } from "@/i18n/navigation";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { FAMILY_COLORS } from "./ArticleRow";

export function ArticleCardSmall({
  article,
  familyLabel,
}: {
  article: ArticleMeta;
  familyLabel: string;
}) {
  return (
    <Link
      href={article.href}
      data-article-id={article.articleId}
      className="group block border border-border-primary bg-bg-secondary p-3 transition-colors hover:border-border-hover"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="text-[9px] font-bold tracking-label"
          style={{ color: FAMILY_COLORS[article.family] }}
        >
          {familyLabel}
        </span>
        <time className="font-mono text-[9px] text-text-tertiary">
          {article.publishedLabel}
        </time>
      </div>
      <h3 className="text-sm font-semibold leading-snug text-text-primary group-hover:underline">
        {article.titleJa}
      </h3>
      {article.excerptJa ? (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-secondary">
          {article.excerptJa}
        </p>
      ) : null}
    </Link>
  );
}
