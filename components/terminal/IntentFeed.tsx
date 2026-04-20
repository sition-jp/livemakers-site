/**
 * IntentFeed — client composer for /[locale]/intents.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-20-lm-task-2-1-tradeintent-design.md §2.4 / §4.2
 *
 * SSR hydration pattern (Task 1-3 SignalsFeed 踏襲): useSWR with
 * fallbackData: initialData + revalidateOnMount: false so first paint is
 * a full list. IntentDisclaimer renders above the list always.
 */
"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { IntentCard } from "./IntentCard";
import { IntentDisclaimer } from "./IntentDisclaimer";
import type { IntentListResponse } from "@/lib/intents-reader";

interface Props {
  locale: "en" | "ja";
  initialData: IntentListResponse;
}

const fetcher = async (url: string): Promise<IntentListResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as IntentListResponse;
};

export function IntentFeed({ locale, initialData }: Props) {
  const tList = useTranslations("intents.list");
  const tError = useTranslations("intents.error");
  const { data, error } = useSWR<IntentListResponse>(
    "/api/intents",
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

  return (
    <div className="space-y-4">
      <IntentDisclaimer />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {tList("title")}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {tList("description")}
        </p>
      </header>
      {snapshot.intents.length === 0 ? (
        <p className="rounded border border-slate-300/70 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
          {tList("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {snapshot.intents.map((summary) => (
            <li key={summary.intent_id}>
              <IntentCard summary={summary} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
