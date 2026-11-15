import { useTranslations } from "next-intl";

import { workedExample, type RangeBandOne } from "@/lib/pivots/range-band";
import type { AssetSymbol } from "@/lib/pivots/types";

export interface WorkedExampleProps {
  asset: AssetSymbol;
  band?: RangeBandOne | null;
  /** 終値の日 (ISO)。省略すると band.as_of。 */
  closeDate?: string;
}

export function WorkedExample({ asset, band, closeDate }: WorkedExampleProps) {
  const t = useTranslations("turningPoints.v2.workedExample");
  if (!band || !band.items.some((i) => i.id === "either7")) return null;
  const v = workedExample(band, asset, closeDate ?? band.as_of);
  return (
    <details open data-testid="worked-example" className="rounded border border-border-primary p-4">
      <summary className="cursor-pointer font-semibold text-text-primary">{t("title")}</summary>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
        {(["s1", "s2", "s3", "s4", "s5"] as const).map((k) => (
          <li key={k}>{t(k, v)}</li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-text-secondary">{t("closing", v)}</p>
    </details>
  );
}
