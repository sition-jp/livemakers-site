import ja from "@/messages/ja.json";
import type { ArticleFamily } from "@/lib/articles/article-model";

/**
 * G3: RSS `<category>` / JSON-LD `articleSection` 用の日本語ラベル。
 *
 * next-intl の `useTranslations` / `getTranslations` は React ツリー内
 * (Server Component) 前提で、Route Handler (`app/**\/route.ts`) や
 * `MetadataRoute` 生成関数からは呼べない。表示用ラベルの正本は
 * `messages/ja.json` の `articles.family` (記事詳細ページと同じ値) なので、
 * ここではその JSON を直接読み、翻訳文字列を二重管理しない。
 */
const FAMILY_LABELS_JA = ja.articles.family as Record<ArticleFamily, string>;

export function familyLabelJa(family: ArticleFamily): string {
  return FAMILY_LABELS_JA[family] ?? family;
}
