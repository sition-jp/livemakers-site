import { Link } from "@/i18n/navigation";
import { pageWindow, seriesPageHref } from "@/lib/articles/series-pagination";

/**
 * シリーズ一覧のページ送り。並びは新しい順なので、← が新しい記事 (前のページ)・
 * → が古い記事 (次のページ)。全リンクは通常の <a> で、クローラがたどれる。
 * 1 ページしかないシリーズでは何も描かない。
 * `hrefFor` を渡すとリンク先を差し替えられる (検索結果 /search?q=…&page=n で共用)。
 */
export function SeriesPagination({
  series,
  page,
  totalPages,
  copy,
  hrefFor,
}: {
  series: string;
  page: number;
  totalPages: number;
  copy: { label: string; newer: string; older: string };
  hrefFor?: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }
  const hrefOf = hrefFor ?? ((number: number) => seriesPageHref(series, number));
  const stepClass =
    "rounded-sm border border-border-primary px-3 py-1.5 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary";

  return (
    <nav
      aria-label={copy.label}
      data-series-pagination=""
      className="mt-8 flex flex-wrap items-center justify-center gap-2 font-mono text-xs"
    >
      {page > 1 && (
        <Link href={hrefOf(page - 1)} rel="prev" className={stepClass}>
          {copy.newer}
        </Link>
      )}
      {pageWindow(page, totalPages).map((number, index) =>
        number === null ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-text-tertiary">
            …
          </span>
        ) : number === page ? (
          <span
            key={number}
            aria-current="page"
            className="min-w-8 rounded-sm border border-text-primary px-2 py-1.5 text-center font-bold text-text-primary"
          >
            {number}
          </span>
        ) : (
          <Link
            key={number}
            href={hrefOf(number)}
            className="min-w-8 rounded-sm border border-border-primary px-2 py-1.5 text-center text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            {number}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link href={hrefOf(page + 1)} rel="next" className={stepClass}>
          {copy.older}
        </Link>
      )}
    </nav>
  );
}
