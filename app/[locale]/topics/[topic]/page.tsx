import type { Metadata } from "next";

import {
  renderTopicListPage,
  topicListMetadata,
} from "@/components/articles/TopicListPage";
import { ARTICLE_TOPICS } from "@/lib/articles/topics";

// 段 1 (2026-11-12): 時間での作り直しは保険 (6 時間)。記事の公開の合図で作り直す
// (lib/revalidate.ts の ARTICLE_LISTING_ROUTES)
export const revalidate = 21600;

export function generateStaticParams() {
  return ARTICLE_TOPICS.map((topic) => ({ topic }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; topic: string }>;
}): Promise<Metadata> {
  const { locale, topic } = await params;
  return topicListMetadata({ locale, topic, page: 1 });
}

// 1 ページ目。2 ページ目以降は ./page/[page]/page.tsx (本体は TopicListPage で共用)。
export default async function ArticleTopicPage({
  params,
}: {
  params: Promise<{ locale: string; topic: string }>;
}) {
  const { locale, topic } = await params;
  return renderTopicListPage({ locale, topic, page: 1 });
}
