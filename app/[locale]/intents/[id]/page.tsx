/**
 * /[locale]/intents/[id] — detail page (server component with SSR hydration).
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §2.4
 */
import { setRequestLocale } from "next-intl/server";
import { IntentDetailFeed } from "@/components/terminal/IntentDetailFeed";
import {
  buildIntentDetailResponse,
  readAndParseIntents,
  resolveIntentsPath,
} from "@/lib/intents-reader";
import {
  readAndParseSignals,
  resolveSignalsPath,
} from "@/lib/signals-reader";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function IntentDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const normalizedLocale: "en" | "ja" = locale === "ja" ? "ja" : "en";

  const intentsRead = readAndParseIntents(resolveIntentsPath());
  const signalsRead = readAndParseSignals(resolveSignalsPath());
  const mtimeMs = intentsRead.mtimeMs ?? 0;
  const freshnessSec =
    mtimeMs === 0 ? -1 : Math.max(0, Math.floor((Date.now() - mtimeMs) / 1000));

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
