import Link from "next/link";
import { useTranslations } from "next-intl";
import type { BriefMetadata } from "@/lib/types";

export function RecentBriefs({
  briefs,
  locale,
}: {
  briefs: BriefMetadata[];
  locale: string;
}) {
  const t = useTranslations("overview");
  if (briefs.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 text-[10px] tracking-label text-text-tertiary">
        {t("recentBriefs")}
      </div>
      <ul className="divide-y divide-border-primary border-y border-border-primary">
        {briefs.map((b) => (
          <li key={b.slug}>
            <Link
              href={`/brief/${b.slug}`}
              className="flex items-baseline justify-between gap-6 px-2 py-4 hover:bg-bg-secondary"
            >
              <div>
                <div className="mb-1 text-[10px] tracking-label text-text-tertiary">
                  ISSUE #{b.issue_number} · {b.publish_date}
                </div>
                <div className="text-sm text-text-primary">
                  {locale === "ja" ? b.title_ja : b.title_en}
                </div>
              </div>
              <div className="text-[10px] tracking-label text-text-tertiary">
                {b.reading_time_min} MIN
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
