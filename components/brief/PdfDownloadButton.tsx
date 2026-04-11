import { useTranslations } from "next-intl";

export function PdfDownloadButton({ pdfPath }: { pdfPath: string }) {
  const t = useTranslations("brief");
  return (
    <a
      href={pdfPath}
      download
      className="inline-flex items-center gap-2 border border-border-primary px-4 py-2 text-[10px] tracking-label text-text-secondary hover:border-pillar-overview hover:text-pillar-overview"
    >
      <span>↓</span>
      <span>{t("downloadPdf")}</span>
    </a>
  );
}
