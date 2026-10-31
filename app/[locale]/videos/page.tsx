import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VideoList } from "@/components/videos/VideoList";
import { localeAlternates } from "@/lib/seo/locale-alternates";
import { getAllVideos } from "@/lib/videos";

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
  return <VideoList videos={getAllVideos()} />;
}
