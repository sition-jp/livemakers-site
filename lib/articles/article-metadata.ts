import type { Metadata } from "next";

import { stripMarkdown, truncate } from "@/lib/brief-metadata";
import type { ArticleMeta } from "@/lib/articles/article-model";

/**
 * 記事詳細ページの OG / Twitter Card metadata を組む (2026-08-07).
 *
 * 背景: 記事ページに `generateMetadata` が無く、root layout の既定
 * metadata がそのまま外へ出ていた。X のカードは記事タイトルでもサムネ
 * でもなく、サイト共通の説明文になる。サムネは Blob に存在しページ内
 * では表示されていたので、欠けていたのは宣言層だけだった。
 *
 * Weekly Brief 側 (`app/[locale]/brief/[slug]/page.tsx`) と同じ形を取り、
 * 画像ソースだけ public/ のファイルから feed 由来の Blob URL
 * (`ArticleMeta.thumbnailUrl` — 検証通過済み) に差し替えている。
 *
 * description の優先順: excerpt → 本文のリード段落 → 省略。
 * サイト共通 description を継承させない (記事ごとに違う説明という前提が
 * 崩れる) が、嘘の説明文を作るよりは省略する。
 */

/** 記事サムネの実寸 (16:9)。ArticleThumbnail の img と揃える。 */
const THUMBNAIL_WIDTH = 1600;
const THUMBNAIL_HEIGHT = 900;

/** JA は Twitter Card 推奨の 180 字、EN は ~200 字まで通る。 */
const DESCRIPTION_MAX = { ja: 180, en: 200 } as const;

export type ArticleMetadataSource = Pick<
  ArticleMeta,
  "articleId" | "titleJa" | "publishedAtJst"
> &
  Partial<Pick<ArticleMeta, "titleEn" | "excerptJa" | "thumbnailUrl">>;

/**
 * MDX 本文の先頭リード段落を取り出す。見出し・引用・リスト・コード
 * フェンス・HTML/JSX 行は本文の導入ではないので飛ばす。
 */
function leadParagraph(body: string): string | null {
  for (const block of body.split(/\n{2,}/)) {
    const text = block.trim();
    if (!text) continue;
    if (/^(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```|<|\||:{3})/.test(text)) continue;
    const flattened = stripMarkdown(text);
    if (flattened) return flattened;
  }
  return null;
}

export function buildArticleMetadata({
  article,
  lang,
  body,
}: {
  article: ArticleMetadataSource;
  lang: "ja" | "en";
  body?: string;
}): Metadata {
  const title =
    lang === "en" ? (article.titleEn ?? article.titleJa) : article.titleJa;

  const descriptionSource =
    article.excerptJa?.trim() || (body ? leadParagraph(body) : null);
  const description = descriptionSource
    ? truncate(stripMarkdown(descriptionSource), DESCRIPTION_MAX[lang])
    : undefined;

  const url = `/${lang}/articles/${article.articleId}`;

  // 画像が無い記事 (mirror lane 例外) では images を宣言しない。
  // 存在しない URL を渡すより、X には画像なしのカードを組ませる。
  const images = article.thumbnailUrl
    ? [
        {
          url: article.thumbnailUrl,
          width: THUMBNAIL_WIDTH,
          height: THUMBNAIL_HEIGHT,
          alt: title,
        },
      ]
    : undefined;

  const openGraph: Metadata["openGraph"] = {
    title,
    description,
    type: "article",
    locale: lang === "ja" ? "ja_JP" : "en_US",
    siteName: "LiveMakers",
    url,
    publishedTime: article.publishedAtJst,
    images,
  };

  // 画像が無いのに summary_large_image を宣言すると、X 側は大枠を用意して
  // から埋めるものが無い状態になる。カード種別は実態に合わせる。
  const twitter: Metadata["twitter"] = article.thumbnailUrl
    ? {
        card: "summary_large_image",
        title,
        description,
        images: [article.thumbnailUrl],
      }
    : { card: "summary", title, description };

  return {
    title,
    description,
    openGraph,
    twitter,
    alternates: { canonical: url },
  };
}
