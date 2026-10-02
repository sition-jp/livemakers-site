import { Link } from "@/i18n/navigation";
import { FAMILY_COLORS } from "@/components/home/ArticleRow";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { splitForHighlight } from "@/lib/search/highlight";

function Highlighted({
  text,
  terms,
}: {
  text: string;
  terms: readonly string[];
}) {
  return (
    <>
      {splitForHighlight(text, terms).map((part, index) =>
        part.hit ? (
          <mark
            key={index}
            className="bg-transparent font-bold text-text-primary underline decoration-2 underline-offset-2"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * 検索結果の 1 行 (2026-10-02 spec)。ArticleThumbRow と同じ枠 (サムネ 16:9・
 * 種別チップ・日付) に、一致語の強調と抜粋 2 行を足したもの。本文一致の行
 * (第2段階) は抜粋の代わりに本文の抜き出し (snippet) を出す。
 */
export function SearchResultRow({
  article,
  familyLabel,
  terms,
  snippet,
}: {
  article: ArticleMeta;
  familyLabel: string;
  terms: readonly string[];
  snippet?: string;
}) {
  const lead = snippet ?? article.excerptJa;
  const color = FAMILY_COLORS[article.family];
  return (
    <Link
      href={article.href}
      data-article-id={article.articleId}
      className="group flex items-start gap-3 border-b border-border-primary px-3 py-3 text-left transition-colors hover:bg-bg-tertiary"
    >
      <span className="mt-0.5 w-24 shrink-0 overflow-hidden rounded">
        {article.thumbnailUrl ? (
          // Blob origin は next/image の許可リスト外運用のため素の img
          // (ArticleThumbRow と同じ判断)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.thumbnailUrl}
            alt=""
            width={160}
            height={90}
            className="aspect-[16/9] h-auto w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="block aspect-[16/9] w-full opacity-80"
            style={{
              background: `linear-gradient(120deg, ${color}, transparent)`,
            }}
          />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-primary group-hover:underline">
          <Highlighted text={article.titleJa} terms={terms} />
        </span>
        {lead ? (
          <span
            data-search-snippet={snippet ? "" : undefined}
            className="mt-1 line-clamp-2 block text-xs leading-relaxed text-text-secondary"
          >
            <Highlighted text={lead} terms={terms} />
          </span>
        ) : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className="rounded-sm border px-1.5 py-0.5 text-[9px] font-bold tracking-label"
            style={{ borderColor: color, color }}
          >
            {familyLabel}
          </span>
          <time
            dateTime={article.publishedAtJst}
            className="whitespace-nowrap font-mono text-[10px] text-text-tertiary"
          >
            {article.publishedLabel}
          </time>
        </span>
      </span>
    </Link>
  );
}
