import { renderSeriesListPage } from "@/components/articles/SeriesListPage";
import { SERIES_SLUGS } from "@/lib/articles/article-model";

export const revalidate = 300;

export function generateStaticParams() {
  return SERIES_SLUGS.map((series) => ({ series }));
}

// 1 ページ目。2 ページ目以降は ./page/[page]/page.tsx (本体は SeriesListPage で共用)。
export default async function ArticleSeriesPage({
  params,
}: {
  params: Promise<{ locale: string; series: string }>;
}) {
  const { locale, series } = await params;
  return renderSeriesListPage({ locale, series, page: 1 });
}
