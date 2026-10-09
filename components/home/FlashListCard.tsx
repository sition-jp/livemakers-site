import { Link } from "@/i18n/navigation";
import type { ArticleMeta } from "@/lib/articles/article-model";

/**
 * md 未満 (モバイル 1 列) で見せる本数 (2026-10-09 田平氏 GO)。モバイルでは本欄が
 * Daily Intel / Signal より上に来るため、20 本並べると中央カラムを大きく押し下げる。
 * 9 本目以降は CSS で隠し、続きは速報一覧リンクへ誘導する。
 */
export const FLASH_LIST_MOBILE_LIMIT = 8;

export interface FlashListCopy {
  title: string;
  empty: string;
  seriesLink: string;
}

/**
 * 左カラムの速報リスト (2026-10-09 田平氏 GO 案 A)。旧 観測カード
 * (RadarObservationsCard・一次ソースへの外部リンク) と同じ位置に、当日+前日の
 * 速報記事を新しい順に並べる。選定 (48h 窓・上限本数) は select-home-slots の
 * slots.flashRecent 側で行い、ここは描画のみ。
 * 行も末尾の速報一覧リンクも索引扱い (data-index-nav) — 速報帯の 1 本を再掲し得る
 * ため articleId 重複検査 (gate 6) から外す。
 */
export function FlashListCard({
  articles,
  copy,
  locale,
}: {
  articles: readonly ArticleMeta[];
  copy: FlashListCopy;
  locale: string;
}) {
  const ja = locale !== "en";
  return (
    <section
      data-flash-list
      className="rounded-lg border border-border-primary bg-bg-secondary p-4"
    >
      <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "var(--lmk-family-flash)" }}
        />
        {copy.title}
      </h3>
      {articles.length > 0 ? (
        <ul className="mt-3 divide-y divide-dashed divide-border-primary">
          {articles.map((article, index) => (
            <li
              key={article.articleId}
              className={
                index >= FLASH_LIST_MOBILE_LIMIT ? "hidden md:block" : undefined
              }
            >
              <Link
                href={article.href}
                data-article-id={article.articleId}
                data-index-nav=""
                className="group block py-2.5"
              >
                <time
                  dateTime={article.publishedAtJst}
                  className="block font-mono text-[10px] text-text-tertiary"
                >
                  {article.publishedAtJst.slice(5, 10).replace("-", "/")}{" "}
                  {article.publishedAtJst.slice(11, 16)}
                </time>
                <span className="mt-1 block text-[13px] font-semibold leading-snug text-text-primary group-hover:underline">
                  {ja ? article.titleJa : (article.titleEn ?? article.titleJa)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-text-tertiary">{copy.empty}</p>
      )}
      <div className="mt-3 text-right">
        <Link
          href="/articles/series/flash"
          data-index-nav=""
          className="text-[11px] tracking-[0.08em] text-text-secondary underline underline-offset-4"
        >
          {copy.seriesLink}
        </Link>
      </div>
    </section>
  );
}
