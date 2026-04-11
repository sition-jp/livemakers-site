import Link from "next/link";
import { useTranslations } from "next-intl";
import { TagLabel } from "@/components/ui/TagLabel";
import type { BriefMetadata } from "@/lib/types";

export function BriefList({
  briefs,
  locale,
}: {
  briefs: BriefMetadata[];
  locale: string;
}) {
  const t = useTranslations("brief");

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="mb-12 text-4xl font-light tracking-title">{t("title")}</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {briefs.map((b) => (
          <Link
            key={b.slug}
            href={`/brief/${b.slug}`}
            className="group block border border-border-primary bg-bg-secondary p-6 transition-colors hover:border-border-hover"
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <TagLabel>
                {t("issuePrefix")}
                {b.issue_number}
              </TagLabel>
              {b.tags.slice(0, 2).map((tag) => (
                <TagLabel key={tag}>{tag.toUpperCase()}</TagLabel>
              ))}
            </div>
            <h2 className="mb-3 text-lg font-bold leading-snug text-text-primary group-hover:text-pillar-overview">
              {locale === "ja" ? b.title_ja : b.title_en}
            </h2>
            <p className="mb-4 line-clamp-3 text-sm text-text-secondary">
              {locale === "ja" ? b.executive_summary_ja : b.executive_summary_en}
            </p>
            <div className="flex items-center justify-between text-[10px] tracking-label text-text-tertiary">
              <span>{b.publish_date}</span>
              <span>
                {b.reading_time_min} {t("readingTime")}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
