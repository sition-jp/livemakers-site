import { useTranslations } from "next-intl";

import { classifyFreshness, type FreshnessTier } from "@/lib/pivots/freshness";

interface FreshnessProps {
  generatedAt: string | null | undefined;
  now?: Date;
}

const TIER_KEY: Record<FreshnessTier, string> = {
  fresh: "fresh",
  stale: "stale",
  very_stale: "veryStale",
  unknown: "unknown",
};

// Reuse existing turning-points design tokens (ScoreBadge LEVEL_CLASS pattern):
//   fresh      → status-up      (positive / OK)
//   stale      → pillar-risk    (warning / informational, not blocking)
//   very_stale → status-down    (negative / needs attention)
//   unknown    → text-tertiary  (muted / no signal)
const TIER_CLASSES: Record<FreshnessTier, string> = {
  fresh: "text-status-up",
  stale: "text-pillar-risk",
  very_stale: "text-status-down",
  unknown: "text-text-tertiary",
};

export function Freshness({ generatedAt, now }: FreshnessProps) {
  const t = useTranslations("turningPoints.freshness");
  const tier = classifyFreshness(generatedAt ?? null, now);
  const tierLabel = t(TIER_KEY[tier]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-text-secondary"
    >
      <span className="text-text-tertiary">{t("label")}:</span>
      {generatedAt ? (
        <time dateTime={generatedAt} className="font-mono text-xs">
          {generatedAt}
        </time>
      ) : null}
      <span
        className={`text-xs uppercase tracking-label font-medium ${TIER_CLASSES[tier]}`}
      >
        {tierLabel}
      </span>
    </div>
  );
}
