import type { ForecastRuntimeState } from "@/lib/future-atlas/replay";

const STATUS_LABELS: Record<ForecastRuntimeState["resolutionStatus"], string> = {
  open: "判定待ち",
  true: "判定: 的中",
  false: "判定: 外れ",
  indeterminate: "判定不能",
  void: "無効",
};

export function ForecastStatusChip({
  status,
}: {
  status: ForecastRuntimeState["resolutionStatus"];
}) {
  return (
    <span className="inline-flex rounded-full border border-border-primary px-2 py-1 text-xs font-medium text-text-secondary">
      {STATUS_LABELS[status]}
    </span>
  );
}
