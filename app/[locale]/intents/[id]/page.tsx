/**
 * /[locale]/intents/[id] — detail page (server component with SSR hydration).
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §2.4
 */
import { setRequestLocale } from "next-intl/server";
import { IntentDetailFeed } from "@/components/terminal/IntentDetailFeed";
import { deploymentFreshnessSec } from "@/lib/deployment-freshness";
import { intentIdParams } from "@/lib/static-params";
import {
  buildIntentDetailResponse,
  readAndParseIntents,
  resolveIntentsPath,
} from "@/lib/intents-reader";
import {
  readAndParseSignals,
  resolveSignalsPath,
} from "@/lib/signals-reader";

// ISR cost doctrine (2026-08-01): prerender every public intent page at
// build; unknown ids 404 statically without invoking a function (each
// on-demand render of a crawler-probed path was a billed ISR write).
export const dynamicParams = false;

export function generateStaticParams() {
  return intentIdParams();
}

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function IntentDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const normalizedLocale: "en" | "ja" = locale === "ja" ? "ja" : "en";

  const intentsRead = readAndParseIntents(resolveIntentsPath());
  const signalsRead = readAndParseSignals(resolveSignalsPath());
  // Build-anchored (NOT Date.now()) so ISR regenerations of unchanged data
  // render identical output → no billed write. Client SWR refreshes live
  // freshness within one poll (ISR cost doctrine, 2026-08-01).
  const freshnessSec = deploymentFreshnessSec(intentsRead.mtimeMs);

  // Visibility=public filter lives inside buildIntentDetailResponse SSOT
  // (lib/intents-reader.ts), symmetric with the /api/intents/[id] route.
  const initialData = buildIntentDetailResponse(
    intentsRead.intents,
    signalsRead.signals,
    id,
    freshnessSec,
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <IntentDetailFeed
        id={id}
        locale={normalizedLocale}
        initialData={initialData}
      />
    </main>
  );
}
