import type { List, ListItem, Root, RootContent } from "mdast";
import type { Plugin } from "unified";

/**
 * 出典節 (= 出典見出しの直後の箇条書き 1 つ) を見つけ、カードにする項目へ
 * `data-source-url` / `data-source-label` を付ける (2026-10-05 設計書
 * source-link-cards §2)。本文の文字列には触れない (描画用の目印だけ)。
 */
export type SourceLink = { url: string; label: string };

export const MAX_SOURCE_CARDS = 8;

const SOURCE_HEADING_KEYS = new Set(["参照", "一次ソース", "一次ソース/関連リンク"]);
const EMBEDDED_HOST_RE =
  /^(?:www\.|m\.|mobile\.)?(?:x\.com|twitter\.com|youtube\.com|youtu\.be)$/i;

type MdNode = {
  type: string;
  value?: string;
  alt?: string | null;
  url?: string;
  children?: MdNode[];
};

function textOf(node: MdNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
  if (node.type === "image") return node.alt ?? "";
  return node.children?.map(textOf).join("") ?? "";
}

function linksIn(node: MdNode, out: MdNode[] = []): MdNode[] {
  if (node.type === "link") out.push(node);
  for (const child of node.children ?? []) linksIn(child, out);
  return out;
}

export function isSourceHeadingText(text: string): boolean {
  const key = text
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[:：]\s*$/u, "")
    .replace(/\s+/gu, "");
  return SOURCE_HEADING_KEYS.has(key);
}

export function isEmbeddedMediaUrl(raw: string): boolean {
  try {
    return EMBEDDED_HOST_RE.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}

function sourceLinkOf(item: ListItem): SourceLink | null {
  const links = linksIn(item as MdNode);
  if (links.length !== 1) return null;
  const url = links[0].url ?? "";
  if (!/^https?:\/\//i.test(url) || isEmbeddedMediaUrl(url)) return null;
  const linkText = textOf(links[0]).trim();
  // 項目の文字から作るときは `出典名: https://…` の区切り記号を落とす
  const label =
    linkText && linkText !== url
      ? linkText
      : textOf(item as MdNode)
          .replace(url, "")
          .replace(/[\s:：\-–—|｜]+$/u, "")
          .trim() || url;
  return { url, label };
}

function isSourceHeadingNode(node: RootContent): boolean {
  if (node.type !== "heading" && node.type !== "paragraph") return false;
  return isSourceHeadingText(textOf(node as MdNode).trim());
}

export function annotateSourceLists(tree: Root): SourceLink[] {
  const found: SourceLink[] = [];
  tree.children.forEach((node, index) => {
    const next = tree.children[index + 1];
    if (!isSourceHeadingNode(node) || next?.type !== "list") return;
    for (const item of (next as List).children) {
      if (found.length >= MAX_SOURCE_CARDS) return;
      const link = sourceLinkOf(item);
      if (!link) continue;
      item.data = {
        ...item.data,
        hProperties: {
          ...item.data?.hProperties,
          "data-source-url": link.url,
          "data-source-label": link.label,
        },
      };
      found.push(link);
    }
  });
  return found;
}

/** `createArticleTocCollector` と同じ型: remark 段階で集め、描画時に読む。 */
export function createSourceCardCollector() {
  const links: SourceLink[] = [];
  const remarkPlugin: Plugin<[], Root> = () => (tree) => {
    links.splice(0, links.length, ...annotateSourceLists(tree));
  };
  return { links, remarkPlugin };
}
