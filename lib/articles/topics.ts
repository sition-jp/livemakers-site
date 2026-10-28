/**
 * テーマ棚 (2026-10-28): 記事の外に置く「棚」の名前。いまは資金調達だけ。
 * 一覧は Blob の topics/<topic>.json (カタログ v2) から読む。
 */
export const ARTICLE_TOPICS = ["funding"] as const;

export type ArticleTopic = (typeof ARTICLE_TOPICS)[number];

export function isArticleTopic(value: string): value is ArticleTopic {
  return (ARTICLE_TOPICS as readonly string[]).includes(value);
}

// locale は付けない (i18n の Link が前置する)
export function topicPageHref(topic: ArticleTopic, page: number): string {
  return page === 1 ? `/topics/${topic}` : `/topics/${topic}/page/${page}`;
}
