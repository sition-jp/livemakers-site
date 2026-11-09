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
