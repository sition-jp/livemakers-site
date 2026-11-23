/**
 * Google 検索に出す記事の種類 (2026-11-10 田平氏 GO)。
 *
 * 速報 (flash) は 1 日に数十本出る短い記事で、多くは報道の要約。続報の
 * Signal と中身が重なる。10/26 以降 Google が LiveMakers を読みに来る量が
 * 落ち、10/15 以降の Signal・Deep Dive の約半分が未登録になったため、
 * 速報をサイトマップから外し `noindex, follow` にして、読みに来る量を
 * Signal・Deep Dive などに集める。ページは残り、X から来た読者は読める。
 * SIPO.TOKYO も 11/9 に同じ形にした (`breaking-x-` を noindex)。
 *
 * 一次情報が起点の速報が育ったら、ここから外して検索に戻す。
 * 調査 = sition-core `08_DOCS/reports/growth/2026-11-10-lvm-index-request-list.md`
 */
export const SEARCH_EXCLUDED_FAMILIES: ReadonlySet<string> = new Set(["flash"]);

export function isSearchIndexableFamily(family: string | undefined | null): boolean {
  return !family || !SEARCH_EXCLUDED_FAMILIES.has(family);
}

/**
 * 記事 1 本を Google 検索に出すか (2026-11-23 田平氏 GO・案 1)。
 *
 * Signal は 11/8 から 1 日 40〜57 本に増え、新しい記事がほとんど登録されなく
 * なった。書き手が付ける印 (X に出す候補の「おすすめ・日本・構造」・1 日 約
 * 13〜18 本) のある Signal だけを検索に出す。印の無い Signal には発行側 (SDE
 * の site-first の emission) が `search_index: false` を付け、ここで
 * サイトマップから外し `noindex, follow` にする。ページは残る。
 *
 * 項目が無い記事は今までどおり検索に出す (過去の記事・ほかの種類・発行側が
 * 付け損ねた記事)。壊れても記事が検索から消える向きには倒れない。
 * 調査 = sition-core `08_DOCS/reports/growth/2026-11-21-google-news-lvm-lmk-not-appearing.md`
 */
export function isSearchIndexableArticle(article: {
  family?: string | null;
  searchIndex?: boolean;
}): boolean {
  return isSearchIndexableFamily(article.family) && article.searchIndex !== false;
}
