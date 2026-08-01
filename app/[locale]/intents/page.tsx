/**
 * /[locale]/intents — list page (server component with SSR hydration).
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §2.4
 *
 * Calls the SAME buildIntentListResponse SSOT as /api/intents, then hands
 * off initialData to IntentFeed. No skeleton on first paint.
 */
import { setRequestLocale } from "next-intl/server";
import { IntentFeed } from "@/components/terminal/IntentFeed";
import { deploymentFreshnessSec } from "@/lib/deployment-freshness";
import {
  buildIntentListResponse,
  readAndParseIntents,
  resolveIntentsPath,
} from "@/lib/intents-reader";

interface PageProps {
  params: Promise<{ locale: string }>;
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
      <IntentFeed locale={normalizedLocale} initialData={initialData} />
    </main>
  );
}
