/**
 * /[locale]/intents — list page (server component with SSR hydration).
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §2.4
 *
 * Calls the SAME buildIntentListResponse SSOT as /api/intents, then hands
 * off initialData to IntentFeed. No skeleton on first paint.
 */
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ScopedIntlProvider } from "@/components/i18n/ScopedIntlProvider";
import { IntentFeed } from "@/components/terminal/IntentFeed";
import { deploymentFreshnessSec } from "@/lib/deployment-freshness";
import {
  buildIntentListResponse,
  readAndParseIntents,
  resolveIntentsPath,
} from "@/lib/intents-reader";
import { localeAlternates } from "@/lib/seo/locale-alternates";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "intents.list" });
  return {
    title: t("title"),
    alternates: localeAlternates(locale, "/intents"),
  };
}

export default async function IntentsListPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const normalizedLocale: "en" | "ja" = locale === "ja" ? "ja" : "en";

  const read = readAndParseIntents(resolveIntentsPath());
  // Build-anchored (NOT Date.now()) so ISR regenerations of unchanged data
  // render identical output → no billed write. Client SWR refreshes live
  // freshness within one 30s poll (ISR cost doctrine, 2026-08-01).
  const freshnessSec = deploymentFreshnessSec(read.mtimeMs);

  const initialData = buildIntentListResponse(read.intents, freshnessSec);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <ScopedIntlProvider scope="intents">
        <IntentFeed locale={normalizedLocale} initialData={initialData} />
      </ScopedIntlProvider>
    </main>
  );
}
