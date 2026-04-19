/**
 * SignalBucketColumn — vertical column for one bucket (actionable / active /
 * resolved). Renders the header + count + a stack of SignalCards, or the
 * bucket-specific empty state when the list is empty.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-signals-api-and-card-ui-design.md §3.3
 *
 * This component is purely compositional — it does not bucketize (parent's
 * job) and does not fetch (page-level SWR hook's job).
 */
import { useTranslations } from "next-intl";
import type { Signal } from "@/lib/signals";
import { SignalCard } from "./SignalCard";
import { SignalsEmptyState } from "./SignalsEmptyState";

export interface SignalBucketColumnProps {
  bucket: "actionable" | "active" | "resolved";
  signals: Signal[];
  locale: "en" | "ja";
}

export function SignalBucketColumn({
  bucket,
  signals,
  locale,
}: SignalBucketColumnProps) {
  const t = useTranslations("signals.bucket");
  return (
    <div
      data-testid={`signal-bucket-${bucket}`}
      className="flex flex-col gap-3"
    >
      <header className="flex items-center justify-between text-xs tracking-label text-text-tertiary uppercase pb-2 border-b border-border-primary/40">
        <span className="font-semibold">{t(bucket)}</span>
        <span className="text-[10px]">({signals.length})</span>
      </header>
      {signals.length === 0 ? (
        <SignalsEmptyState bucket={bucket} />
      ) : (
        signals.map((s) => (
          <SignalCard key={s.id} signal={s} locale={locale} bucket={bucket} />
        ))
      )}
    </div>
  );
}
