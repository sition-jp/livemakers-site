/**
 * SignalCard — one signal rendered as a Bloomberg-terminal-style card.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-signals-api-and-card-ui-design.md §3.2, §3.4
 *
 * Responsibilities (single-responsibility — the card does not classify):
 * - Render a single Signal in a given locale + bucket.
 * - Localize headline / summary per locale, strip "EN translation pending."
 *   marker from the body and surface it as a small footer aside.
 * - Apply bucket-specific accent (border color, background tint, opacity,
 *   actionable alarm icon, resolved status badge).
 * - Degrade gracefully when optional fields are absent (position_hint,
 *   primary_asset, evidence).
 *
 * What this component does NOT do:
 * - Bucketize signals — the parent page classifies and passes `bucket` in.
 * - Fetch data.
 * - Enforce or modify locked_fields semantics (reader's job).
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Signal } from "@/lib/signals";

export interface SignalCardProps {
  signal: Signal;
  locale: "en" | "ja";
  bucket: "actionable" | "active" | "resolved";
  compact?: boolean;
}

const PILLAR_LABEL_EN: Record<Signal["pillar"], string> = {
  market_and_capital_flows: "MARKET",
  ecosystem_health: "ECOSYSTEM",
  governance_and_treasury: "GOVERNANCE",
  midnight_and_privacy: "MIDNIGHT",
  risk_and_compliance: "RISK",
  project_research: "RESEARCH",
};

const TRANSLATION_PENDING_MARKER = "EN translation pending.";

const BUCKET_STYLES: Record<
  SignalCardProps["bucket"],
  { border: string; bg: string; opacity: string }
> = {
  actionable: {
    border: "border-l-4 border-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    opacity: "opacity-100",
  },
  active: {
    border: "border-l-4 border-blue-500",
    bg: "bg-slate-50 dark:bg-slate-900/40",
    opacity: "opacity-100",
  },
  resolved: {
    border: "border-l-4 border-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/20",
    opacity: "opacity-75",
  },
};

/**
 * Format age from a timestamp relative to "now". We use Intl for number
 * formatting but keep the unit thresholds custom (per spec §3.5) to avoid
 * pulling a date library.
 */
function formatAge(
  timestamp: string,
  t: ReturnType<typeof useTranslations<"signals.card">>,
  locale: "en" | "ja"
): string {
  const then = new Date(timestamp).getTime();
  const now = Date.now();
  const deltaMs = Math.max(0, now - then);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return t("age_minutes", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("age_hours", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("age_days", { n: days });
  // Fall back to locale-formatted date for anything older than a week.
  return new Date(timestamp).toLocaleDateString(
    locale === "ja" ? "ja-JP" : "en-US",
    { year: "numeric", month: "2-digit", day: "2-digit" }
  );
}

function localize(
  signal: Signal,
  locale: "en" | "ja"
): { headline: string; summary: string; pendingTranslation: boolean } {
  if (locale === "ja") {
    return {
      headline: signal.headline_ja || signal.headline_en,
      summary: signal.summary_ja || signal.summary_en,
      pendingTranslation: false,
    };
  }
  const isPending = signal.summary_en.includes(TRANSLATION_PENDING_MARKER);
  const summary = isPending
    ? signal.summary_en.replace(TRANSLATION_PENDING_MARKER, "").trim()
    : signal.summary_en;
  return {
    headline: signal.headline_en || signal.headline_ja,
    summary,
    pendingTranslation: isPending,
  };
}

export function SignalCard({
  signal,
  locale,
  bucket,
  compact = false,
}: SignalCardProps) {
  const t = useTranslations("signals.card");
  const { headline, summary, pendingTranslation } = localize(signal, locale);
  const styles = BUCKET_STYLES[bucket];
  const latestTs = signal.updated_at ?? signal.created_at;

  const pillarLabel = PILLAR_LABEL_EN[signal.pillar];
  const confidencePct = Math.round(signal.confidence * 100);

  const resolvedStatusKey =
    signal.status === "expired"
      ? "status_expired"
      : signal.status === "invalidated"
        ? "status_invalidated"
        : signal.status === "superseded"
          ? "status_superseded"
          : null;

  const evidenceCount = signal.evidence.length;
  const evidenceLabel =
    evidenceCount === 1
      ? t("evidence_count_one", { count: evidenceCount })
      : t("evidence_count_other", { count: evidenceCount });

  return (
    <article
      className={`relative ${styles.border} ${styles.bg} ${styles.opacity} p-4 rounded-sm shadow-sm transition-colors hover:bg-accent/5`}
      data-signal-id={signal.id}
      data-bucket={bucket}
    >
      <Link
        href={`/${locale}/signals/${signal.id}`}
        aria-label={`View details for ${headline}`}
        className="absolute inset-0 z-10"
      />
      {/* Header: bucket badge + pillar + asset · confidence · age */}
      <header className="flex items-center justify-between text-[10px] tracking-widest text-text-tertiary mb-2">
        <div className="flex items-center gap-2">
          {bucket === "actionable" && (
            <span data-testid="actionable-icon" aria-hidden>
              ⏰
            </span>
          )}
          <span>{pillarLabel}</span>
          {signal.primary_asset && (
            <span
              data-testid="signal-asset-badge"
              className="px-1.5 py-0.5 border border-border-primary rounded-sm"
            >
              {signal.primary_asset}
            </span>
          )}
          {bucket === "resolved" && resolvedStatusKey && (
            <span
              data-testid="resolved-status-badge"
              className="px-1.5 py-0.5 border border-gray-400 rounded-sm text-gray-500"
            >
              {t(resolvedStatusKey)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>{confidencePct}%</span>
          <span>·</span>
          <span>{formatAge(latestTs, t, locale)}</span>
        </div>
      </header>

      {/* Headline */}
      <h3 className="text-base font-semibold leading-snug mb-2">
        {headline}
      </h3>

      {/* Summary (omitted in compact mode) */}
      {!compact && (
        <p
          data-testid="signal-summary"
          className="text-sm text-text-secondary leading-relaxed line-clamp-3 mb-3"
        >
          {summary}
        </p>
      )}

      {/* Direction · impact · time_horizon */}
      <div className="flex items-center gap-2 text-xs text-text-secondary mb-2">
        <span className="font-medium">{signal.direction}</span>
        <span>·</span>
        <span>{signal.impact} impact</span>
        <span>·</span>
        <span>{signal.time_horizon}</span>
      </div>

      {/* Position hint (only when present) */}
      {signal.position_hint && (
        <div className="text-xs text-text-secondary mb-2">
          <span>💼 </span>
          <span className="font-medium">{signal.position_hint.stance}</span>
          <span className="ml-2">
            {t("conviction", { value: signal.position_hint.conviction })}
          </span>
        </div>
      )}

      {/* Footer: evidence count + related assets (omitted in compact mode) */}
      {!compact && (
        <footer className="text-[11px] text-text-tertiary pt-2 border-t border-border-primary/40">
          <div className="flex items-center gap-3 flex-wrap">
            <span>{evidenceLabel}</span>
            {signal.related_assets.length > 0 && (
              <span>
                {t("related_assets")}: {signal.related_assets.join(", ")}
              </span>
            )}
          </div>
          {/* Chips: type / subtype (for quick scan) */}
          <div
            data-testid="signal-chips"
            className="flex items-center gap-1 flex-wrap mt-2"
          >
            <span className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm">
              {signal.type}
            </span>
            <span className="px-1.5 py-0.5 bg-bg-tertiary rounded-sm">
              {signal.subtype}
            </span>
          </div>
          {pendingTranslation && (
            <aside className="text-[11px] italic text-amber-600 mt-2">
              {t("translation_pending")}
            </aside>
          )}
        </footer>
      )}
    </article>
  );
}
