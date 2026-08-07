/**
 * 長文 TOC 抽出 (G44 D10 / PR-2)。本文 markdown の `## ` 見出しに加え、
 * X 公開体裁の平文マーカー見出し (■ / Daily Intel ブロック絵文字) を対象にする。
 * mirror/site-first の本文バイトは feed checksum の証跡なので変更せず、
 * 昇格は描画側 (ArticleBodyComponents) とここでの抽出の両方で同じ規則を使う。
 * コードフェンス内は無視する。id は描画側の見出しと同一規則で生成し、
 * アンカーリンクをクライアント JS なしで成立させる。
 * 表示条件 (見出しが 3 本未満なら非表示) は呼び出し側の責務で、本関数は全件返す。
 */

export interface TocItem {
  id: string;
  text: string;
}

export type MarkerHeadingLevel = 2 | 3;

/** Daily Intel B'' ブロックの見出し絵文字 (doctrine 固定の 7 ブロック構成)。
 * タイトル行の 📋 / 関連記事の 📌 / フッターの 🌐 は含めない。 */
const DAILY_INTEL_BLOCK_MARKERS = ["🎯", "🧭", "📊", "⚡", "🔄", "📎"] as const;

/** Signal / Deep Dive の章マーカー (■) と Daily Intel 二層の副マーカー (▫)。 */
const SQUARE_MARKER = "■";
const SUB_MARKER = "▫";

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

/** 本文が Daily Intel のブロック絵文字見出しを持つか (■/▫ を h3 に落とす文脈判定)。 */
export function hasDailyIntelBlockHeadings(markdown: string): boolean {
  return markdown
    .split(/\r?\n/)
    .some((line) => isDailyIntelBlockLine(line.trim()));
}

function isDailyIntelBlockLine(trimmed: string): boolean {
  return DAILY_INTEL_BLOCK_MARKERS.some((marker) =>
    trimmed.startsWith(`${marker} `),
  );
}

/**
 * 単一行テキストが表示層見出しマーカーか判定する。standalone 判定
 * (前後が空行か、markdown 上その行だけで段落を成すか) は呼び出し側の責務。
 * ■ は Signal/DD では章 (h2)、Daily Intel 文脈では 📎 内の副見出し (h3)。
 */
export function classifyMarkerHeading(
  text: string,
  hasDailyIntelBlocks: boolean,
): { level: MarkerHeadingLevel } | null {
  const trimmed = text.trim();
  if (isDailyIntelBlockLine(trimmed)) return { level: 2 };
  if (trimmed.startsWith(`${SQUARE_MARKER} `)) {
    return { level: hasDailyIntelBlocks ? 3 : 2 };
  }
  if (trimmed.startsWith(`${SUB_MARKER} `)) return { level: 3 };
  return null;
}

/** 次行が段落を継続しない (= マーカー行が単独段落になる) かの近似判定。
 * 空行・リスト・ATX 見出し・フェンス・引用は CommonMark 上段落を中断する。
 * 実データは空行かリスト開始のみだが、描画側の段落単位判定との乖離を
 * 減らすため中断構文を広めに許容する。 */
const PARAGRAPH_INTERRUPTER = /^\s*(?:$|[-*+]\s|#{1,6}\s|```|~~~|>)/;

export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const used = new Map<string, number>();
  const hasBlocks = hasDailyIntelBlockHeadings(markdown);
  const lines = markdown.split(/\r?\n/);
  let fence: string | null = null;

  const claimId = (text: string): string => {
    const base = slugifyHeading(text);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
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
    if (heading) {
      items.push({ id: claimId(heading[1]), text: heading[1] });
      continue;
    }

    const marker = classifyMarkerHeading(line, hasBlocks);
    if (!marker) continue;
    const prev = index === 0 ? "" : lines[index - 1];
    const next = index + 1 >= lines.length ? "" : lines[index + 1];
    if (prev.trim() !== "" || !PARAGRAPH_INTERRUPTER.test(next)) continue;
    const text = line.trim();
    // level 3 (■/▫ 副見出し) は TOC に載せないが、描画側と id の序数を
    // 揃えるため claim だけ行う (同名見出しの -2 suffix ずれ防止)。
    const id = claimId(text);
    if (marker.level === 2) items.push({ id, text });
  }
  return items;
}
