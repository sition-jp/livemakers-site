import Link from "next/link";
import { useTranslations } from "next-intl";
import { TagLabel } from "@/components/ui/TagLabel";
import type { Brief } from "@/lib/types";

export function EditorialHero({ brief, locale }: { brief: Brief; locale: string }) {
  const t = useTranslations("overview");
  const title = locale === "ja" ? brief.metadata.title_ja : brief.metadata.title_en;
  const summary =
    locale === "ja"
      ? brief.metadata.executive_summary_ja
      : brief.metadata.executive_summary_en;

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-6 flex items-center gap-3">
        <TagLabel>{t("latestBrief")}</TagLabel>
        {brief.metadata.tags.slice(0, 3).map((tag) => (
          <TagLabel key={tag}>{tag.toUpperCase()}</TagLabel>
        ))}
      </div>
      <h1 className="mb-6 max-w-4xl text-4xl font-light tracking-title md:text-5xl">
        {title}
      </h1>
      <p className="mb-8 max-w-3xl text-lg leading-relaxed text-text-secondary">
        {summary}
      </p>
      <div className="mb-8 flex flex-wrap gap-6 text-[10px] tracking-label text-text-tertiary">
        <span>SIPO RESEARCH</span>
        <span>{brief.metadata.reading_time_min} MIN READ</span>
        <span>EN / 日本語</span>
        <span>EPOCH {brief.metadata.epoch}</span>
        <span>{brief.metadata.publish_date}</span>
      </div>
      <Link
        href={`/brief/${brief.slug}`}
        className="inline-block border border-pillar-overview px-6 py-3 text-xs tracking-label text-pillar-overview hover:bg-pillar-overview hover:text-bg-primary transition-colors"
      >
        {t("readFullBrief")}
      </Link>
    </section>
  );
}
