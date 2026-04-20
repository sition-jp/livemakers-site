/**
 * SignalDetailFeed — client composer for /[locale]/signals/[id].
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-task-1-3-signal-detail-design.md
 *       §5.5 v0.2 F5 (SSR hydration) + v0.3 F5 (latestId from asc-last).
 *
 * Orchestrates all Phase D components. Receives the SSR-resolved
 * SignalDetailResponse as `initialData` so the first paint is a full
 * detail view (no skeleton). SWR refreshes every 30s on the client;
 * `revalidateOnMount: false` avoids a second fetch immediately after
 * hydration.
 */
"use client";

import useSWR from "swr";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SignalDetailResponse } from "@/lib/signals-reader";
import { SignalCardExpanded } from "./SignalCardExpanded";
import { SignalFieldGrid } from "./SignalFieldGrid";
import { SignalChainTable } from "./SignalChainTable";
import { SignalDetailStatusBanner } from "./SignalDetailStatusBanner";
import { ChainIntegrityNotice } from "./ChainIntegrityNotice";

interface Props {
  id: string;
  locale: "en" | "ja";
  initialData: SignalDetailResponse;
}

const fetcher = async (url: string): Promise<SignalDetailResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as SignalDetailResponse;
};

export function SignalDetailFeed({ id, locale, initialData }: Props) {
  const tNotFound = useTranslations("signals.detail.not_found");
  const tBack = useTranslations("signals.detail");
  const tChainStatus = useTranslations("signals.detail.chain_status");
  const tError = useTranslations("signals.error");
  const tBacklink = useTranslations("signals.detail.referenced_by_intents");

  const { data, error } = useSWR<SignalDetailResponse>(
    `/api/signals/${encodeURIComponent(id)}`,
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
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        {tError("unavailable")}
      </div>
    );
  }

  if (snapshot.chain_status === "not_found") {
    return (
      <div>
        <Link
          href={`/${locale}/signals`}
          className="text-sm underline opacity-70"
        >
          {tBack("back_to_signals")}
        </Link>
        <div className="mt-4 rounded border border-slate-200 dark:border-slate-800 p-6">
          <h1 className="text-xl font-semibold">{tNotFound("title")}</h1>
          <p className="mt-2 text-sm">{tNotFound("message", { id })}</p>
        </div>
      </div>
    );
  }

  const current = snapshot.signal!;
  const latestInChain =
    snapshot.chain_status === "ok" && snapshot.chain.length > 0
      ? snapshot.chain[snapshot.chain.length - 1]
      : null;
  const latestId =
    latestInChain && latestInChain.id !== current.id ? latestInChain.id : null;

  return (
    <div className="space-y-4">
      <Link
        href={`/${locale}/signals`}
        className="text-sm underline opacity-70"
      >
        {tBack("back_to_signals")}
      </Link>

      <SignalDetailStatusBanner
        signal={current}
        locale={locale}
        latestId={latestId}
      />

      {snapshot.chain_status === "missing_root_trace" && (
        <div
          role="note"
          data-testid="missing-root-trace-banner"
          className="rounded border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
        >
          {tChainStatus("missing_root_trace")}
        </div>
      )}

      <SignalCardExpanded signal={current} locale={locale} />

      {snapshot.chain_status === "ok" && snapshot.chain.length > 1 && (
        <SignalChainTable
          chain={snapshot.chain}
          currentId={current.id}
          locale={locale}
        />
      )}

      {snapshot.chain_integrity_warnings.length > 0 && (
        <ChainIntegrityNotice
          warnings={snapshot.chain_integrity_warnings}
          locale={locale}
        />
      )}

      <SignalFieldGrid signal={current} locale={locale} defaultOpen={false} />

      {snapshot.referencing_intent_ids &&
      snapshot.referencing_intent_ids.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {tBacklink("title")}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {snapshot.referencing_intent_ids.map((intentId) => (
              <li key={intentId}>
                <Link
                  href={`/${locale}/intents/${intentId}`}
                  className="font-mono text-sky-700 underline underline-offset-2 dark:text-sky-400"
                >
                  {intentId}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
