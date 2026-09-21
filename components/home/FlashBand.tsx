import { Link } from "@/i18n/navigation";
import type { ArticleMeta } from "@/lib/articles/article-model";

/**
 * トップの速報帯 (2026-09-21 田平氏 GO 案 1・SIPO.TOKYO のピンク速報帯と同型)。
 * 当日/前日の最新速報 1 本だけを masthead 直下に出し、無い日は帯ごと出さない。
 * 鮮度判定は select-home-slots (slots.flashLatest) 側で行い、ここは描画のみ。
 * 色は family flash のトークン (--lmk-family-flash)。
 */
export function FlashBand({
  article,
  locale,
}: {
  article: ArticleMeta | null;
  locale: string;
}) {
  if (!article) return null;
  const ja = locale !== "en";
  const title = ja ? article.titleJa : (article.titleEn ?? article.titleJa);
  const time = article.publishedAtJst.slice(11, 16);
  const date = article.publishedAtJst.slice(5, 10).replace("-", "/");
  return (
    <section
      data-home-section="flash"
      aria-label={ja ? "速報" : "Flash"}
      className="mx-auto mt-4 flex max-w-[1760px] flex-wrap items-center gap-3 rounded-lg border-l-4 px-4 py-3 md:px-8"
      style={{
        borderColor: "var(--lmk-family-flash)",
        background: "color-mix(in srgb, var(--lmk-family-flash) 8%, transparent)",
      }}
    >
      <span
        className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.14em] text-white"
        style={{ background: "var(--lmk-family-flash)" }}
      >
        {ja ? "速報" : "FLASH"}
      </span>
      <span className="font-mono text-[11px] text-text-tertiary">
        {date} {time}
      </span>
      <Link
        href={article.href}
        className="min-w-0 flex-1 basis-[320px] text-[15px] font-bold leading-snug text-text-primary hover:underline"
      >
        {title}
      </Link>
      <Link
        href="/articles/series/flash"
        className="text-[11px] tracking-[0.08em] text-text-secondary underline underline-offset-4"
      >
        {ja ? "速報一覧" : "All flash"}
      </Link>
    </section>
  );
}
