/**
 * IntentDetailFeed — client composer for /[locale]/intents/[id].
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §4.4
 *
 * SSR hydration pattern. Composes IntentDisclaimer (always) +
 * IntentDetailStatusBanner (conditional) + IntentCardExpanded +
 * IntentConvictionGrid + SourceSignalTable, with not_found branch.
 */
"use client";

import useSWR from "swr";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { IntentDetailResponse } from "@/lib/intents-reader";
import { IntentDisclaimer } from "./IntentDisclaimer";
import { IntentDetailStatusBanner } from "./IntentDetailStatusBanner";
import { IntentCardExpanded } from "./IntentCardExpanded";
import { IntentConvictionGrid } from "./IntentConvictionGrid";
import { SourceSignalTable } from "./SourceSignalTable";

interface Props {
  id: string;
  locale: "en" | "ja";
  initialData: IntentDetailResponse;
}

const fetcher = async (url: string): Promise<IntentDetailResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as IntentDetailResponse;
};

export function IntentDetailFeed({ id, locale, initialData }: Props) {
  const tDetail = useTranslations("intents.detail");
  const tNotFound = useTranslations("intents.detail.not_found");
  const tError = useTranslations("intents.error");

  const { data, error } = useSWR<IntentDetailResponse>(
    `/api/intents/${encodeURIComponent(id)}`,
    fetcher,
    {
      refreshInterval: 30_000,
      fallbackData: initialData,
      revalidateOnMount: false,
    },
  );
  const snapshot = data ?? initialData;

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
        {tError("unavailable")}
      </div>
    );
  }

  if (snapshot.status === "not_found" || !snapshot.intent) {
    return (
      <div className="space-y-4">
        <IntentDisclaimer />
        <div className="rounded border border-slate-300/70 bg-white p-6 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <h1 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {tNotFound("title")}
          </h1>
          <p className="mb-3">{tNotFound("description")}</p>
          <Link
            href={`/${locale}/intents`}
            className="text-sky-700 underline underline-offset-2 dark:text-sky-400"
          >
            {tNotFound("back_link")}
          </Link>
        </div>
      </div>
    );
  }

  const intent = snapshot.intent;
  return (
    <div className="space-y-6">
      <IntentDisclaimer />
      <Link
        href={`/${locale}/intents`}
        className="inline-block text-xs uppercase tracking-wide text-sky-700 underline underline-offset-2 dark:text-sky-400"
      >
        ← {tDetail("back_link")}
      </Link>
      <IntentDetailStatusBanner status={intent.status} />
      <IntentCardExpanded intent={intent} locale={locale} />
      <IntentConvictionGrid
        thesis_conviction={intent.thesis_conviction}
        execution_confidence={intent.execution_confidence}
        priority={intent.priority}
        preferred_horizon={intent.preferred_horizon}
        bucket={intent.portfolio_context.bucket}
        locale={locale}
      />
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {tDetail("section.source_signals")}
        </h2>
        <SourceSignalTable
          signals={snapshot.source_signals}
          missing={snapshot.source_signals_missing}
          locale={locale}
        />
      </section>
    </div>
  );
}
