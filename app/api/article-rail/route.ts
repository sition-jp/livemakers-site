import { loadArticleRailFeed } from "@/lib/articles/article-rail-feed-server";

// 記事ページの右レーンと関連記事が読む (components/articles/ArticleRailClient.tsx)。
// 材料 (rail.json・カタログ) の取得は前と同じ保存期間とタグなので、新しくなる
// 時機も前と同じ (cron の合図 = lvm-article-optional)。中身が変わらない間は
// ISR の書き込みは発生しない。1 日の時間での作り直しは保険 (isr-intervals テスト)
export const revalidate = 86400;

export async function GET() {
  return Response.json(await loadArticleRailFeed());
}
