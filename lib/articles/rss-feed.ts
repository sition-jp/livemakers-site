import { getArticleBody } from "@/lib/articles/article-model";
import type { ArticleInflowPublicArticle } from "@/lib/articles/article-inflow-contract";
import { familyLabelJa } from "@/lib/articles/family-labels";
import { escapeXml } from "@/lib/articles/xml-escape";
import { stripMarkdown, truncate } from "@/lib/brief-metadata";
import { SITE_URL } from "@/lib/site";

export const RSS_FEED_ITEM_COUNT = 50;
const DESCRIPTION_MAX_CHARS = 200;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `publishedAtJst` (常に `+09:00` 付き ISO) を RFC 822 pubDate へ変換する。
 * `article-inflow-contract.ts` の `toJstParts` と同じ「UTC ms に 9h 足して
 * UTC getter で読む」手法 — サーバのローカルタイムゾーンに依存しない。
 */
export function toRfc822Jst(iso: string): string {
  const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${WEEKDAYS[jst.getUTCDay()]}, ${pad(jst.getUTCDate())} ` +
    `${MONTHS[jst.getUTCMonth()]} ${jst.getUTCFullYear()} ` +
    `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())} +0900`
  );
}

/**
 * `<description>` の本文: excerpt 優先・無ければ本文の先頭 200 字。
 * 本文取得は同期経路 (repository 記事 = fs / inflow 記事 = feed が運んできた
 * `inflowBody`) のみを使う — FEEDSPLIT v1 の `bodyUrl` 別ホスト取得は
 * RSS 生成 1 回につき最大 50 リクエストになり得るため踏まない。取得でき
 * なければタイトルを最後の拠り所にする (空 description にしない)。
 */
export function resolveArticleDescription(
  article: ArticleInflowPublicArticle,
): string {
  const raw =
    article.excerptJa ??
    article.inflowBody ??
    (article.source === "repository"
      ? safeGetRepositoryBody(article.articleId)
      : null);
  if (!raw) return article.titleJa;
  return truncate(stripMarkdown(raw), DESCRIPTION_MAX_CHARS);
}

function safeGetRepositoryBody(slug: string): string | null {
  try {
    return getArticleBody(slug, "ja");
  } catch {
    return null;
  }
}

function buildItemXml(article: ArticleInflowPublicArticle): string {
  const link = `${SITE_URL}/ja${article.href}`;
  const description = resolveArticleDescription(article);
  const enclosure = article.thumbnailUrl
    ? `\n      <enclosure url="${escapeXml(article.thumbnailUrl)}" type="image/webp" />`
    : "";
  return `    <item>
      <title>${escapeXml(article.titleJa)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${toRfc822Jst(article.publishedAtJst)}</pubDate>
      <description>${escapeXml(description)}</description>
      <category>${escapeXml(familyLabelJa(article.family))}</category>${enclosure}
    </item>`;
}

/**
 * RSS 2.0 フィード本体。`selfUrl` は `<atom:link rel="self">` — `/ja/feed.xml`
 * と `/ja/feed` の両方から同じ builder を呼ぶため呼び出し側が渡す。
 */
export function buildRssFeedXml(
  articles: ArticleInflowPublicArticle[],
  selfUrl: string,
): string {
  const items = articles.slice(0, RSS_FEED_ITEM_COUNT).map(buildItemXml).join("\n");
  const lastBuildDate =
    articles.length > 0 ? toRfc822Jst(articles[0].publishedAtJst) : toRfc822Jst(new Date().toISOString());

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>LiveMakers</title>
    <link>${SITE_URL}/ja</link>
    <description>LiveMakers — SITION Group の金融再起動インテリジェンス・ターミナル</description>
    <language>ja</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
