import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LatestArticlesRailLayout } from "@/components/articles/LatestArticlesRailLayout";
import { VideoList } from "@/components/videos/VideoList";
import { loadLatestArticlesRail } from "@/lib/articles/latest-articles-rail";
import { localeAlternates } from "@/lib/seo/locale-alternates";
import { getAllVideos } from "@/lib/videos";

// 右レール「最新の記事」をシリーズ一覧と同じ間隔で新しくする (2026-10-31 田平氏 GO)
// 段 1 (2026-11-12): 時間での作り直しは保険 (6 時間)。記事の公開の合図で作り直す
// (lib/revalidate.ts の ARTICLE_LISTING_ROUTES)
export const revalidate = 21600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "videos" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: localeAlternates(locale, "/videos"),
  };
}

export default async function VideosIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const rail = await loadLatestArticlesRail({ locale });
  return (
    <LatestArticlesRailLayout rail={rail}>
      <VideoList videos={getAllVideos()} />
    </LatestArticlesRailLayout>
  );
}
