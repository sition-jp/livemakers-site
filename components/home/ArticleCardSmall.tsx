import { Link } from "@/i18n/navigation";
import { ArticleThumbnail } from "@/components/articles/ArticleThumbnail";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { FAMILY_COLORS } from "./ArticleRow";

/**
 * サムネ付きの小カード (Deep Dive featured / ERR / 索引カードの最新 1 本で共用)。
 * `indexNav` は ArticleRow / ArticleThumbRow と同じ意味論 — data-index-nav を
 * アンカーに付与し articleId 重複検査 (gate 6) から除外する (索引系モジュール用)。
 */
export function ArticleCardSmall({
  article,
  familyLabel,
  thumbVariant = "fixed",
  indexNav = false,
}: {
  article: ArticleMeta;
  familyLabel: string;
  /** Phase 3b (2026-08-14): ERR カードは 16:9 の半分 (32:9 中央 crop) */
  thumbVariant?: "fixed" | "shortWide";
  indexNav?: boolean;
}) {
  return (
    <Link
      href={article.href}
      data-article-id={article.articleId}
      data-index-nav={indexNav ? "" : undefined}
      className="group block border border-border-primary bg-bg-secondary p-3 transition-colors hover:border-border-hover"
    >
      <ArticleThumbnail
        thumbnailUrl={article.thumbnailUrl}
        family={article.family}
        title={article.titleJa}
        variant={thumbVariant}
        className="mb-2"
      />
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
