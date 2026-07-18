import type { ForecastRuntimeState } from "@/lib/future-atlas/replay";

const STATUS_LABELS: Record<"ja" | "en", Record<ForecastRuntimeState["resolutionStatus"], string>> = {
  ja: {
    open: "観測中",
    true: "判定: 的中",
    false: "判定: 外れ",
    indeterminate: "判定不能",
    void: "無効",
  },
  en: {
    open: "Monitoring",
    true: "Resolved: correct",
    false: "Resolved: incorrect",
    indeterminate: "Indeterminate",
    void: "Void",
  },
};

export function ForecastStatusChip({
  status,
  locale = "ja",
}: {
  status: ForecastRuntimeState["resolutionStatus"];
  locale?: "ja" | "en";
}) {
  return (
    <span className="inline-flex rounded-full border border-border-primary px-2 py-1 text-xs font-medium text-text-secondary">
      {STATUS_LABELS[locale][status]}
    </span>
  );
}
