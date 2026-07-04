import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TerminalPreviewSurface } from "@/components/livemakers-terminal-preview/TerminalPreviewSurface";
import { terminalPreviewAdapterFixtureMock } from "@/lib/livemakers-terminal-preview/adapter-fixture-data";

export const metadata: Metadata = {
  title: "LiveMakers Terminal Preview",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TerminalPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terminalPreview");

  return (
    <TerminalPreviewSurface
      locale={locale === "ja" ? "ja" : "en"}
      data={terminalPreviewAdapterFixtureMock}
      copy={{
        mockBadge: t("mockBadge"),
        fixtureOnly: t("fixtureOnly"),
        unavailable: t("unavailable"),
        boundaryTitle: t("boundaryTitle"),
        boundaryBody: t("boundaryBody"),
        sourceLedgerTitle: t("sourceLedgerTitle"),
      }}
    />
  );
}
