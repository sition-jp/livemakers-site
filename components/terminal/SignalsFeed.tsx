"use client";

/**
 * SignalsFeed — client-side SWR integration that fetches /api/signals and
 * bucketizes the result into three columns (actionable / active / resolved).
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-signals-api-and-card-ui-design.md §3.3, §4.1, §6
 *
 * Key design choices:
 * - Bucket classification happens here (client side) per spec §4.1 — the API
 *   returns semantic data and UI decides presentation. The API can pre-filter
 *   by `bucket` query param for Phase 2 optimization, but initial render
 *   fetches bucket=all and classifies locally.
 * - SWR polls every 60s, matching the server's in-memory cache TTL and
 *   HTTP Cache-Control s-maxage. Stale serve on error is automatic.
 * - Error state renders a degraded banner + any cached data. Initial loading
 *   renders a minimal placeholder; we don't block the whole page on the
 *   first fetch because the page shell (header, footer, nav) is useful on
 *   its own.
 */
import { useTranslations } from "next-intl";
import useSWR from "swr";
import type { Signal } from "@/lib/signals";
import { SignalBucketColumn } from "./SignalBucketColumn";
import { SignalsEmptyState } from "./SignalsEmptyState";

interface SignalsResponse {
  signals: Signal[];
  meta: {
    total_active: number;
    returned: number;
    min_confidence: number;
    generated_at: string;
    source_freshness_sec: number;
  };
}

async function fetcher(url: string): Promise<SignalsResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`/api/signals ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

function bucketize(signals: Signal[]): {
  actionable: Signal[];
  active: Signal[];
  resolved: Signal[];
} {
  const RESOLVED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const actionable: Signal[] = [];
  const active: Signal[] = [];
  const resolved: Signal[] = [];
  for (const s of signals) {
    if (s.status === "active") {
      const isActionable =
        s.confidence >= 0.8 &&
        (s.impact === "high" || s.impact === "critical");
      if (isActionable) actionable.push(s);
      else active.push(s);
      continue;
    }
    // resolved buckets only surface the last 7 days (per spec §3.3)
    const latestTs = s.updated_at ?? s.created_at;
    const latestMs = new Date(latestTs).getTime();
    if (!isNaN(latestMs) && now - latestMs <= RESOLVED_WINDOW_MS) {
      resolved.push(s);
    }
  }
  return { actionable, active, resolved };
}

export interface SignalsFeedProps {
  locale: "en" | "ja";
}

export function SignalsFeed({ locale }: SignalsFeedProps) {
  const t = useTranslations("signals");
  const { data, error, isLoading } = useSWR<SignalsResponse>(
    "/api/signals?bucket=all",
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      // keepPreviousData means the UI shows the last successful payload
      // while a background revalidate is in flight, avoiding empty flashes
      // on intermittent network glitches.
      keepPreviousData: true,
    }
  );

  if (isLoading && !data) {
    return (
      <div className="text-sm text-text-tertiary py-12 text-center">…</div>
    );
  }

  // Hard error AND no cached data — show the 503-style banner with no
  // content. Once data arrives once, subsequent errors fall through to
  // the keepPreviousData + banner path below.
  if (error && !data) {
    return (
      <div
        data-testid="signals-error-banner"
        className="border border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-200 rounded-sm"
      >
        {t("error.unavailable")}
      </div>
    );
  }

  const signals = data?.signals ?? [];
  const { actionable, active, resolved } = bucketize(signals);

  // Whole-feed empty (first-time / pre-SDE-launch) — show the explanation
  // block instead of 3 empty columns side-by-side.
  if (signals.length === 0) {
    return (
      <div className="py-12">
        <SignalsEmptyState bucket="all" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          data-testid="signals-error-banner"
          className="border border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-200 rounded-sm"
        >
          {t("error.unavailable")}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        <SignalBucketColumn
          bucket="actionable"
          signals={actionable}
          locale={locale}
        />
        <SignalBucketColumn
          bucket="active"
          signals={active}
          locale={locale}
        />
        <SignalBucketColumn
          bucket="resolved"
          signals={resolved}
          locale={locale}
        />
      </div>
    </div>
  );
}
