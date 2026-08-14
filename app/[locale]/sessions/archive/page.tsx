import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SessionArchiveList } from "@/components/sessions/SessionArchiveList";
import { resolveTodayJst } from "@/lib/home/resolve-today";
import { getAllSessionRecords } from "@/lib/sessions/session-content";

/**
 * Intelligence Terminal セッション記事の一覧 (2026-08-14 Phase 3b 田平氏指示)。
 * 直近 1 週間分を載せ、それより古い記録は /sessions/archive/past (全記録) へ。
 * crystallize auto-PR (毎朝 06:35) の merge で毎日 4 本ずつ伸びる。
 * 直近 1 週間が空の日 (バックフィル前など) は最新 12 本で埋める —
 * 空のリストを見せない (honest fallback)。
 */
const RECENT_WINDOW_DAYS = 7;
const EMPTY_FALLBACK_COUNT = 12;

export default async function SessionArchivePage({
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
  const today = resolveTodayJst(new Date());
  const cutoff = new Date(`${today}T00:00:00+09:00`);
  cutoff.setDate(cutoff.getDate() - RECENT_WINDOW_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const recent = records.filter((record) => record.date >= cutoffDate);
  const visible = recent.length > 0
    ? recent
    : records.slice(0, EMPTY_FALLBACK_COUNT);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-text-primary">
        {t("archiveTitle")}
      </h1>
      <p className="mt-3 text-sm text-text-secondary">{t("archiveNote")}</p>
      <div className="mt-8">
        <SessionArchiveList records={visible} familyLabel={t("family")} />
      </div>
      <div data-index-nav className="mt-6">
        <Link
          href="/sessions/archive/past"
          className="text-sm font-bold text-accent"
        >
          {t("archivePastLink")}
        </Link>
      </div>
    </main>
  );
}
