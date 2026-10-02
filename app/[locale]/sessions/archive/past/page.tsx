import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { LatestArticlesRailLayout } from "@/components/articles/LatestArticlesRailLayout";
import { SessionArchiveList } from "@/components/sessions/SessionArchiveList";
import { loadLatestArticlesRail } from "@/lib/articles/latest-articles-rail";
import { getAllSessionRecords } from "@/lib/sessions/session-content";

// 右レール「最新の記事」を記事一覧 (series) と同じ間隔で更新する (2026-10-02)
export const revalidate = 300;

/**
 * Intelligence Terminal セッション記事の全記録 (2026-08-14 Phase 3b)。
 * /sessions/archive が直近 1 週間・本ページが全量アーカイブ。
 */
export default async function SessionArchivePastPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("sessions");
  const records = getAllSessionRecords().filter(
    (record) => record.articleStatus === "published",
  );

  const rail = await loadLatestArticlesRail();

  return (
    <LatestArticlesRailLayout rail={rail}>
      <main className="min-w-0">
        <h1 className="text-3xl font-bold text-text-primary">
          {t("archivePastTitle")}
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          {t("archivePastNote")}
        </p>
        <div className="mt-8">
          <SessionArchiveList records={records} familyLabel={t("family")} />
        </div>
        <div data-index-nav className="mt-6">
          <Link href="/sessions/archive" className="text-sm font-bold text-accent">
            {t("archiveRecentLink")}
          </Link>
        </div>
      </main>
    </LatestArticlesRailLayout>
  );
}
