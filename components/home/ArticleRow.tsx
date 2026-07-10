import { Link } from "@/i18n/navigation";
import type {
  ArticleFamily,
  ArticleMeta,
} from "@/lib/articles/article-model";

export const FAMILY_COLORS: Record<ArticleFamily, string> = {
  "daily-intel": "var(--lmk-family-intel)",
  signal: "var(--lmk-family-signal)",
  "deep-dive": "var(--lmk-family-deep-dive)",
  "future-map": "var(--lmk-family-future-map)",
  "mkt12-morning": "var(--lmk-family-mkt12)",
  "mkt12-weekend": "var(--lmk-family-mkt12-weekend)",
  "event-risk-radar": "var(--lmk-family-event-risk)",
  "weekly-brief": "var(--lmk-family-weekly-brief)",
  session: "var(--lmk-family-session)",
};

export function ArticleRow({
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
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border-primary px-3 py-2.5 text-left transition-colors hover:bg-bg-tertiary"
    >
      <span
        className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold tracking-label"
        style={{
          borderColor: FAMILY_COLORS[article.family],
          color: FAMILY_COLORS[article.family],
        }}
      >
        {familyLabel}
      </span>
      <span className="min-w-0 text-sm font-semibold text-text-primary group-hover:underline">
        {article.titleJa}
      </span>
      <time className="whitespace-nowrap font-mono text-[10px] text-text-tertiary">
        {article.publishedLabel}
      </time>
    </Link>
  );
}
