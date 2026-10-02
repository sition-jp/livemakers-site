/**
 * 表示用の強調区間 (2026-10-02 spec)。原文に対して各語を大文字小文字だけ無視して
 * 探す。全角半角の揺れで原文に見つからない時は強調しないだけ (一致判定は
 * searchArticles 側)。小文字化で長さが変わる文字を含む原文は位置がずれるので
 * 強調しない。
 */
export function splitForHighlight(
  text: string,
  terms: readonly string[],
): { text: string; hit: boolean }[] {
  const lower = text.toLowerCase();
  if (terms.length === 0 || lower.length !== text.length) {
    return [{ text, hit: false }];
  }
  const ranges: [number, number][] = [];
  for (const term of terms) {
    if (!term) continue;
    let from = lower.indexOf(term);
    while (from !== -1) {
      ranges.push([from, from + term.length]);
      from = lower.indexOf(term, from + 1);
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];
  ranges.sort((left, right) => left[0] - right[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  const parts: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), hit: false });
    parts.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}
