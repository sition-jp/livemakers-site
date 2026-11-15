import { useTranslations } from "next-intl";

import { legendItems, type RangeBandOne } from "@/lib/pivots/range-band";

export interface WhatItDoesNotTellProps {
  band?: RangeBandOne | null;
}

export function WhatItDoesNotTell({ band }: WhatItDoesNotTellProps) {
  const t = useTranslations("turningPoints.v2.doesNotTell");
  const b7 = band ? legendItems(band).find((l) => l.id === "b7") : undefined;
  if (!b7) return null;
  return (
    <details open data-testid="does-not-tell" className="rounded border border-border-primary p-4">
      <summary className="cursor-pointer font-semibold text-text-primary">{t("title")}</summary>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-text-secondary">
        {(["i1", "i2", "i3", "i4", "i5"] as const).map((k) => (
          <li key={k}>
            <b className="text-text-primary">{t(`${k}.lead`)}</b>
            {t(`${k}.body`, { tenN: b7.tenN })}
          </li>
        ))}
      </ul>
    </details>
  );
}
