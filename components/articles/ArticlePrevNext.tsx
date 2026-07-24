import { Link } from "@/i18n/navigation";
import type { ArticleMeta } from "@/lib/articles/article-model";

/**
 * 同シリーズの前後ナビ (G44 D10)。publishedAtJst 順の隣接記事へ移動する。
 * 端の記事では片側のみ描画し、両側 null なら何も出さない。
 */
export function ArticlePrevNext({
  prev,
  next,
  prevLabel,
  nextLabel,
}: {
  prev: ArticleMeta | null;
  next: ArticleMeta | null;
  prevLabel: string;
  nextLabel: string;
}) {
  if (!prev && !next) return null;
  return (
    <nav
      data-article-prev-next=""
      className="mt-10 grid gap-3 border-t border-border-primary pt-6 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={prev.href}
          data-prev=""
          className="group rounded-lg border border-border-primary bg-bg-secondary p-4 transition-colors hover:bg-bg-tertiary"
        >
          <span className="text-[10px] font-bold tracking-label text-text-tertiary">
            ← {prevLabel}
          </span>
          <span className="mt-1 block text-sm font-semibold text-text-primary group-hover:underline">
            {prev.titleJa}
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={next.href}
          data-next=""
          className="group rounded-lg border border-border-primary bg-bg-secondary p-4 text-right transition-colors hover:bg-bg-tertiary"
        >
          <span className="text-[10px] font-bold tracking-label text-text-tertiary">
            {nextLabel} →
          </span>
          <span className="mt-1 block text-sm font-semibold text-text-primary group-hover:underline">
            {next.titleJa}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
