import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  renderTopicListPage,
  topicListMetadata,
} from "@/components/articles/TopicListPage";
import { redirect } from "@/i18n/navigation";
import { parseSeriesPageParam } from "@/lib/articles/series-pagination";
import { isArticleTopic, topicPageHref } from "@/lib/articles/topics";

export const revalidate = 300;

// ページ数は記事の増加で変わるため事前生成しない (初回アクセス時に生成し
// revalidate 300 で更新)。
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; topic: string; page: string }>;
}): Promise<Metadata> {
  const { locale, topic, page: pageParam } = await params;
  const page = parseSeriesPageParam(pageParam);
  if (page === null) return {};
  return topicListMetadata({ locale, topic, page });
}

// 2 ページ目以降 (/topics/{topic}/page/{n})。/page/1 は 1 ページ目へ転送する。
export default async function ArticleTopicPagedPage({
  params,
}: {
  params: Promise<{ locale: string; topic: string; page: string }>;
}) {
  const { locale, topic, page: pageParam } = await params;
  const page = parseSeriesPageParam(pageParam);
  if (page === null || !isArticleTopic(topic)) {
    notFound();
  }
  if (page === 1) {
    redirect({ href: topicPageHref(topic, 1), locale });
  }
  return renderTopicListPage({ locale, topic, page });
}
