import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SessionArchiveList } from "@/components/sessions/SessionArchiveList";
import { getAllSessionRecords } from "@/lib/sessions/session-content";

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

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
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
  );
}
