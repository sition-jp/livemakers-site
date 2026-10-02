import { notFound } from "next/navigation";

import { renderSeriesListPage } from "@/components/articles/SeriesListPage";
import { redirect } from "@/i18n/navigation";
import { parseSeriesPageParam, seriesPageHref } from "@/lib/articles/series-pagination";

export const revalidate = 300;

// ページ数は記事の増加で毎日変わるため事前生成しない (初回アクセス時に生成し
// revalidate 300 で更新)。空配列 = 全パスを実行時に静的生成。
export function generateStaticParams() {
  return [];
}

// 2 ページ目以降 (/articles/series/{series}/page/{n})。1 ページ目は一覧の
// ルート URL に一本化するため /page/1 はそちらへ転送する。
export default async function ArticleSeriesPagedPage({
  params,
}: {
  params: Promise<{ locale: string; series: string; page: string }>;
}) {
  const { locale, series, page: pageParam } = await params;
  const page = parseSeriesPageParam(pageParam);
  if (page === null) {
    notFound();
  }
  if (page === 1) {
    redirect({ href: seriesPageHref(series, 1), locale });
  }
  return renderSeriesListPage({ locale, series, page });
}
