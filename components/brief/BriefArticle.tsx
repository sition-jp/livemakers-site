"use client";

import { useState } from "react";
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote";
import { LanguageToggle } from "./LanguageToggle";
import { PdfDownloadButton } from "./PdfDownloadButton";
import type { BriefMetadata } from "@/lib/types";

export function BriefArticle({
  metadata,
  bodyEnSerialized,
  bodyJaSerialized,
  pdfPath,
  initialLang,
}: {
  metadata: BriefMetadata;
  bodyEnSerialized: MDXRemoteSerializeResult;
  bodyJaSerialized: MDXRemoteSerializeResult;
  pdfPath: string;
  initialLang: "en" | "ja";
}) {
  const [lang, setLang] = useState<"en" | "ja">(initialLang);
  const title = lang === "ja" ? metadata.title_ja : metadata.title_en;
  const body = lang === "ja" ? bodyJaSerialized : bodyEnSerialized;

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-[10px] tracking-label text-text-tertiary">
            ISSUE #{metadata.issue_number} · {metadata.week_label}
          </span>
        </div>
        <h1 className="mb-6 text-4xl font-light tracking-title md:text-5xl">{title}</h1>
        <div className="mb-6 flex flex-wrap items-center gap-4 text-[10px] tracking-label text-text-tertiary">
          <span>SIPO RESEARCH</span>
          <span>{metadata.reading_time_min} MIN READ</span>
          <span>EPOCH {metadata.epoch}</span>
          <span>{metadata.publish_date}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LanguageToggle defaultLang={initialLang} onChange={setLang} />
          {metadata.has_pdf && <PdfDownloadButton pdfPath={pdfPath} />}
        </div>
      </header>

      <div className="prose prose-invert max-w-none prose-headings:font-light prose-headings:tracking-title prose-a:text-pillar-overview">
        <MDXRemote {...body} />
      </div>
    </article>
  );
}
