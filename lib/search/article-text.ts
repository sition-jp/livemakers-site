import {
  DROP_LEADING_EXACT_TITLE_V1,
  applyArticleDisplayTransform,
} from "@/lib/articles/display-transform";

export const SEARCH_TEXT_MAX_CHARS = 20_000;

/**
 * 本文 → 検索用テキスト (テキスト化規則 v1・2026-10-02 spec)。SDE の
 * livemakers_export/inflow/search_index_builder.article_search_text と同じ規則。
 * SDE が shard で配る inflow 記事と、サイトが自分のファイルから作る repo 記事は
 * 集合が重ならない (catalog は repo を優先) ので、同じ規則であれば十分。
 *
 * 先頭のタイトル行 (表示層と同じ drop-leading-exact-title-v1) → markdown
 * リンクは文字だけ残す → URL を除去 → 見出し・強調・引用・表・■▫ の記号を
 * 空白に → 空白を詰める → 20,000 文字 (code point) で打ち切り。
 */
export function articleSearchText(
  body: string,
  title: string,
): { text: string; truncated: boolean } {
  const text = applyArticleDisplayTransform(
    body,
    title,
    DROP_LEADING_EXACT_TITLE_V1,
  )
    .displayBody.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#*>|`■▫]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(text);
  return chars.length > SEARCH_TEXT_MAX_CHARS
    ? { text: chars.slice(0, SEARCH_TEXT_MAX_CHARS).join(""), truncated: true }
    : { text, truncated: false };
}
