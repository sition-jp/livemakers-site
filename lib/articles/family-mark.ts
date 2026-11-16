import type { ArticleFamily } from "@/lib/articles/article-model";

/**
 * 種類の印 (2026-11-16 題のラベルを外す設計 §5-2)。
 *
 * 記事の題から種類のラベル (`📡 Signal｜` など) を外すので、印でシリーズを
 * 見分ける働きを題の外 = 種類のバッジへ移す。絵文字は今のラベルの絵文字に揃え、
 * 今のラベルに絵文字の無い種類 (future-map・12 指標) だけ新しく決めた
 * (future-map 🔭・mkt12 📈 は仮)。空文字は「印を付けない」(速報・セッション・
 * 未来アトラス)。サイトで印を持つのはこの表だけ。
 *
 * 型を `Record<ArticleFamily, string>` にしているので、ARTICLE_FAMILIES に
 * 種類を足すと、ここに行を足すまで型検査が通らない。
 *
 * 機械が読む所 (JSON-LD の articleSection・RSS の <category>・llms.txt) には
 * 印を付けない (family-labels.ts の名前だけ)。
 */
export const FAMILY_MARK: Readonly<Record<ArticleFamily, string>> = {
  "daily-intel": "📋",
  signal: "📡",
  "deep-dive": "🔬",
  "weekly-brief": "📊",
  landmark: "📍",
  "event-risk-radar": "📌",
  // 今のラベル `🗺️ 金融再起動の現在地 #N｜` と同じ (U+1F5FA U+FE0F)
  "restart-map": "🗺️",
  "future-map": "🔭",
  "mkt12-morning": "📈",
  "mkt12-weekend": "📈",
  session: "",
  "future-atlas": "",
  flash: "",
};

export function familyMark(family: ArticleFamily): string {
  return FAMILY_MARK[family] ?? "";
}

/** バッジの文字 = 印 + 空白 + 種類の名前。印の無い種類は名前だけ。 */
export function familyBadgeText(family: ArticleFamily, label: string): string {
  const mark = familyMark(family);
  return mark ? `${mark} ${label}` : label;
}
