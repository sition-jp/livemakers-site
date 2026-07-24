/**
 * 長文 TOC 抽出 (G44 D10 / PR-2)。本文 markdown の `## ` 見出しのみを対象にし、
 * コードフェンス内は無視する。id は描画側の h2 と同一規則で生成し、
 * アンカーリンクをクライアント JS なしで成立させる。
 * 表示条件 (h2 が 3 本未満なら非表示) は呼び出し側の責務で、本関数は全件返す。
 */

export interface TocItem {
  id: string;
  text: string;
}

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const used = new Map<string, number>();
  let fence: string | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      if (fence === null) {
        fence = fenceMatch[1];
      } else if (fenceMatch[1] === fence) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (!heading) continue;
    const text = heading[1];
    const base = slugifyHeading(text);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    items.push({ id: count === 1 ? base : `${base}-${count}`, text });
  }
  return items;
}
