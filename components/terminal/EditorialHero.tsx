import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { TagLabel } from "@/components/ui/TagLabel";
import { pickBriefImage, stripMarkdown, truncate } from "@/lib/brief-metadata";
import type { Brief } from "@/lib/types";

const SUMMARY_MAX_CHARS = 220;

export function EditorialHero({ brief, locale }: { brief: Brief; locale: string }) {
  const t = useTranslations("overview");
  const lang = locale === "ja" ? "ja" : "en";
  const title = lang === "ja" ? brief.metadata.title_ja : brief.metadata.title_en;
  const rawSummary =
    lang === "ja"
      ? brief.metadata.executive_summary_ja
      : brief.metadata.executive_summary_en;
  const summary = truncate(stripMarkdown(rawSummary), SUMMARY_MAX_CHARS);
  const thumbnail = pickBriefImage(brief.slug, lang);

  return (
    <section className="mx-auto max-w-7xl px-6 pt-10 pb-12">
      <div className="mb-4 flex items-center gap-3">
        <TagLabel>{t("latestBrief")}</TagLabel>
        {brief.metadata.tags.slice(0, 3).map((tag) => (
          <TagLabel key={tag}>{tag.toUpperCase()}</TagLabel>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-7">
          <h1 className="mb-5 text-4xl font-light leading-tight tracking-title md:text-5xl md:leading-[1.2]">
            {title}
          </h1>
          <p className="mb-6 text-lg leading-relaxed text-text-secondary">
            {summary}
          </p>
          <div className="mb-6 flex flex-wrap gap-6 text-[10px] tracking-label text-text-tertiary">
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
        </div>
        {thumbnail && (
          <div className="md:col-span-5">
            <Link href={`/brief/${brief.slug}`} className="block">
              <img
                src={thumbnail}
                alt={title}
                width={1792}
                height={1024}
                className="w-full h-auto rounded-sm border border-border-primary"
                loading="eager"
              />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
