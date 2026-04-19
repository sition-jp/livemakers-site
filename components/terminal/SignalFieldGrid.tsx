/**
 * SignalFieldGrid — collapsible full-schema inspector.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-19-lm-task-1-3-signal-detail-design.md §5.6.1
 *
 * Manual field mapping grouped by concern. Per v0.3 Finding 4 note:
 * schema additions require additive updates to this component — primary
 * view (SignalCardExpanded) stays unchanged.
 */
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Signal } from "@/lib/signals";

interface Props {
  signal: Signal;
  locale: "en" | "ja";
  defaultOpen?: boolean;
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function SignalFieldGrid({ signal, locale: _locale, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const t = useTranslations("signals.detail.field_grid");
  const tMeta = useTranslations("signals.detail.meta");

  const sections: Array<{ key: string; rows: Array<[string, unknown]> }> = [
    {
      key: "identity",
      rows: [
        [tMeta("id"), signal.id],
        [tMeta("event_key"), signal.event_key],
        [tMeta("root_trace_id"), signal.root_trace_id],
        ["supersedes_signal_id", (signal as Signal & { supersedes_signal_id?: string | null }).supersedes_signal_id],
      ],
    },
    {
      key: "status_timing",
      rows: [
        ["status", signal.status],
        [tMeta("created_at"), signal.created_at],
        [tMeta("updated_at"), (signal as Signal & { updated_at?: string }).updated_at],
        ["expires_at", (signal as Signal & { expires_at?: string }).expires_at],
      ],
    },
    {
      key: "classification",
      rows: [
        ["pillar", signal.pillar],
        ["type", (signal as Signal & { type?: string }).type],
        ["subtype", (signal as Signal & { subtype?: string }).subtype],
        ["direction", signal.direction],
        ["impact", (signal as Signal & { impact?: string }).impact],
        ["time_horizon", (signal as Signal & { time_horizon?: string }).time_horizon],
        ["urgency", (signal as Signal & { urgency?: string | number }).urgency],
      ],
    },
    {
      key: "assets_topics",
      rows: [
        ["primary_asset", signal.primary_asset],
        ["related_assets", (signal as Signal & { related_assets?: string[] }).related_assets],
        ["topics", (signal as Signal & { topics?: string[] }).topics],
      ],
    },
    {
      key: "translation_state",
      rows: [
        ["headline_en", signal.headline_en],
        ["headline_ja", signal.headline_ja],
        ["summary_en", signal.summary_en],
        ["summary_ja", signal.summary_ja],
      ],
    },
    {
      key: "audit_lock",
      rows: [
        ["audit_note", (signal as Signal & { audit_note?: string | null }).audit_note],
        ["locked_fields", (signal as Signal & { locked_fields?: string[] | Record<string, string> | null }).locked_fields],
      ],
    },
    {
      key: "evidence_full",
      rows: ((signal as Signal & { evidence?: Array<Record<string, unknown>> }).evidence ?? [])
        .map((ev, i) => [`evidence[${i}]`, JSON.stringify(ev)] as [string, unknown]),
    },
  ];

  return (
    <details
      className="rounded-md border border-slate-200 dark:border-slate-800 p-4 mt-4"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        className="cursor-pointer text-sm font-medium"
        onClick={(e) => {
          // Ensure the state flips even in environments where <details>
          // doesn't natively toggle (e.g. jsdom). In real browsers both the
          // native toggle and this handler settle to the same `open` value.
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
      >
        {open ? t("toggle_close") : t("toggle_open")}
      </summary>
      {open && (
        <div className="mt-4 space-y-6">
          {sections.map((sec) => (
            <section key={sec.key}>
              <h2 className="text-xs uppercase tracking-wide opacity-60 mb-2">
                {t(`sections.${sec.key}` as "sections.identity")}
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-x-4 gap-y-1 font-mono text-xs">
                {sec.rows.map(([label, value]) => (
                  <div key={String(label)} className="contents">
                    <dt className="opacity-60">{String(label)}</dt>
                    <dd className="break-all">{display(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </details>
  );
}
