/**
 * /[locale]/signals/[id] — detail page (server component with SSR hydration).
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-task-1-3-signal-detail-design.md
 *       §5.4 v0.2 F5 + v0.3 F3.
 *
 * Resolves signal + chain + response at request time via
 * buildSignalDetailResponse — the SAME call the API route uses —
 * and hands off to SignalDetailFeed as initialData. No skeleton on
 * first paint for direct links.
 */
import { setRequestLocale } from "next-intl/server";
import { SignalDetailFeed } from "@/components/terminal/SignalDetailFeed";
import {
  buildSignalDetailResponse,
  readAndParseSignals,
  resolveSignalsPath,
} from "@/lib/signals-reader";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function SignalDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const normalizedLocale: "en" | "ja" = locale === "ja" ? "ja" : "en";

  const jsonlPath = resolveSignalsPath();
  const readResult = readAndParseSignals(jsonlPath);
  const mtimeMs = readResult.mtimeMs ?? 0;
  const freshnessSec =
    mtimeMs === 0 ? -1 : Math.max(0, Math.floor((Date.now() - mtimeMs) / 1000));

  const initialData = buildSignalDetailResponse(
    readResult.signals,
    id,
    freshnessSec,
  );

  return (
    <main className="container mx-auto max-w-4xl px-4 py-6">
      <SignalDetailFeed
        id={id}
        locale={normalizedLocale}
        initialData={initialData}
      />
    </main>
  );
}
