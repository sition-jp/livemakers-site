/**
 * 本文一致の抜き出し (サイト内検索 第2段階)。原文で最初に現れる語 (大文字小文字
 * だけ無視) の前後 radius 文字を返す。全角半角の揺れで原文に語が見つからない時は
 * 先頭 radius×2 文字。途中を切った側には「…」を付ける。文字数は code point で数える。
 */
export function bodySnippet(
  raw: string,
  terms: readonly string[],
  radius = 40,
): string {
  const chars = Array.from(raw);
  const lower = Array.from(raw.toLowerCase());
  let start = -1;
  let matchLength = 0;
  if (lower.length === chars.length) {
    const haystack = lower.join("");
    for (const term of terms) {
      const unitIndex = term ? haystack.indexOf(term) : -1;
      if (unitIndex === -1) continue;
      // UTF-16 位置 → code point 位置
      const index = Array.from(haystack.slice(0, unitIndex)).length;
      if (start === -1 || index < start) {
        start = index;
        matchLength = Array.from(term).length;
      }
    }
  }
  if (start === -1) {
    const head = chars.slice(0, radius * 2).join("");
    return chars.length > radius * 2 ? `${head}…` : head;
  }
  const from = Math.max(0, start - radius);
  const to = Math.min(chars.length, start + matchLength + radius);
  return `${from > 0 ? "…" : ""}${chars.slice(from, to).join("")}${to < chars.length ? "…" : ""}`;
}
