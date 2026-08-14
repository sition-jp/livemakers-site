import { Link } from "@/i18n/navigation";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { FAMILY_COLORS } from "./ArticleRow";

/**
 * 小サムネ付きの記事行 (2026-08-14 Phase 3b 田平氏要望)。
 * 直近の Signal 全行と Deep Dive の題名行で共用する。サムネ未検証/無しの
 * 記事は family 色のグラデーション帯で枠を保つ (CLS ゼロ・ArticleThumbnail
 * と同じ判断)。`indexNav` は ArticleRow と同じ dedup 免除の意味論。
 */
export function ArticleThumbRow({
  article,
  familyLabel,
  indexNav = false,
}: {
  article: ArticleMeta;
  familyLabel: string;
  indexNav?: boolean;
}) {
  return (
    <Link
      href={article.href}
      data-article-id={article.articleId}
      data-index-nav={indexNav ? "" : undefined}
      data-thumb-row
      className="group flex items-center gap-3 border-b border-border-primary px-3 py-2.5 text-left transition-colors hover:bg-bg-tertiary"
    >
      <span className="w-24 shrink-0 overflow-hidden rounded">
        {article.thumbnailUrl ? (
          // Blob origin は next/image の許可リスト外運用のため素の img
          // (ArticleThumbnail と同じ判断)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.thumbnailUrl}
            alt={article.titleJa}
            width={160}
            height={90}
            className="aspect-[16/9] h-auto w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="block aspect-[16/9] w-full opacity-80"
            style={{
              background: `linear-gradient(120deg, ${FAMILY_COLORS[article.family]}, transparent)`,
            }}
          />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-primary group-hover:underline">
          {article.titleJa}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold tracking-label"
            style={{
              borderColor: FAMILY_COLORS[article.family],
              color: FAMILY_COLORS[article.family],
            }}
          >
            {familyLabel}
          </span>
          <time className="whitespace-nowrap font-mono text-[10px] text-text-tertiary">
            {article.publishedLabel}
          </time>
        </span>
      </span>
    </Link>
  );
}
