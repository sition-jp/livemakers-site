import { useTranslations } from "next-intl";

import type { ForecastRuntimeState } from "@/lib/future-atlas/replay";

export function ForecastStatusChip({
  status,
}: {
  status: ForecastRuntimeState["resolutionStatus"];
}) {
  const t = useTranslations("futureAtlas.status");

  return (
    <span className="inline-flex rounded-full border border-border-primary px-2 py-1 text-xs font-medium text-text-secondary">
      {t(status)}
    </span>
  );
}
