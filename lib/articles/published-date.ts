/**
 * G3 (2026-09-11 田平氏 GO): 記事詳細ページの可視の公開日を「年あり」に
 * 拡張する。カード群 (`ArticleRow` / `ArticleCardSmall` / `LeadArticleCard` /
 * `ArticleThumbRow`) が使う短い `publishedLabel`
 * (`article-inflow-contract.ts` の `MM-DD HH:MM 公開`) はレイアウト上の
 * 幅制約があるため touch しない — ここは詳細ページ専用の別フォーマッタ。
 *
 * `publishedAtJst` は常に `YYYY-MM-DDTHH:MM(:SS)+09:00` のwall-clock JST
 * 文字列 (`ArticleMetaSchema` の `JST_ISO` 正規表現で保証) なので、
 * Date へ経由せず文字列のまま切り出す — サーバのローカルタイムゾーンに
 * 一切依存しない。
 */
export function formatPublishedLabelWithYear(publishedAtJst: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(publishedAtJst);
  if (!match) return publishedAtJst;
  const [, date, hour, minute] = match;
  return `${date} ${hour}:${minute} 公開`;
}
