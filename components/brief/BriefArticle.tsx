import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { BriefLanguageSwitch } from "./BriefLanguageSwitch";
import { PdfDownloadButton } from "./PdfDownloadButton";
import type { BriefMetadata } from "@/lib/types";

const mdxOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
  },
};

export function BriefArticle({
  metadata,
  body,
  pdfPath,
  lang,
}: {
  metadata: BriefMetadata;
  body: string;
  pdfPath: string;
  lang: "en" | "ja";
}) {
  const title = lang === "ja" ? metadata.title_ja : metadata.title_en;

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-[10px] tracking-label text-text-tertiary">
            ISSUE #{metadata.issue_number} · {metadata.week_label}
          </span>
        </div>
        <h1 className="mb-6 text-4xl font-light leading-tight tracking-title md:text-5xl md:leading-[1.2]">
          {title}
        </h1>
        <div className="mb-6 flex flex-wrap items-center gap-4 text-[10px] tracking-label text-text-tertiary">
          <span>SIPO RESEARCH</span>
          <span>{metadata.reading_time_min} MIN READ</span>
          <span>EPOCH {metadata.epoch}</span>
          <span>{metadata.publish_date}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <BriefLanguageSwitch slug={metadata.slug} currentLang={lang} />
          {metadata.has_pdf && <PdfDownloadButton pdfPath={pdfPath} />}
        </div>
      </header>

      <div className="prose prose-invert max-w-none prose-headings:font-light prose-headings:tracking-title prose-a:text-pillar-overview">
        <MDXRemote source={body} options={mdxOptions} />
      </div>
    </article>
  );
}
