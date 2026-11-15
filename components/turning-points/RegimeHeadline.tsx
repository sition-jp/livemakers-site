"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatPrice } from "@/lib/pivots/forecast";
import {
  chipParts,
  headlineParts,
  shockParts,
  type LayerId,
  type Part,
  type RegimeOne,
} from "@/lib/pivots/regime";
import type { AssetSymbol } from "@/lib/pivots/types";

export interface RegimeHeadlineProps {
  asset: AssetSymbol;
  regime?: RegimeOne | null;
}

const LAYERS: readonly LayerId[] = ["long", "mid", "near"];

function nextSunday(iso: string): { m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 7));
  return { m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function RegimeHeadline({ asset, regime }: RegimeHeadlineProps) {
  const t = useTranslations("turningPoints.v2");
  const locale = useLocale();
  const chips = regime ? chipParts(regime) : null;
  const available = chips ? LAYERS.filter((l) => chips[l]) : [];
  const [picked, setPicked] = useState<LayerId | null>(null);
  if (!regime || !chips || available.length === 0) return null;

  const layer: LayerId =
    picked && chips[picked] ? picked : chips.long ? "long" : chips.near ? "near" : "mid";
  const parts = headlineParts(regime, layer);
  const shock = shockParts(regime);
  const say = (p: Part) => t(p.key, p.values);

  const long = regime.long;
  let flip: string | null = null;
  if (long) {
    const line = long.line_to_down ?? long.line_to_leave_down;
    if (line !== null && line !== undefined) {
      const when = nextSunday(long.last_week);
      const [, wm, wd] = long.last_week.split("-").map(Number);
      flip =
        t("updated.week", { month: wm, day: wd }) +
        (locale === "en" ? " " : "") +
        t("updated.flip", {
          asset,
          month: when.m,
          day: when.d,
          price: formatPrice(line),
          dir: long.line_to_down !== null ? "below" : "above",
          state: long.line_to_down !== null ? "down" : "recovering",
        });
    }
  }

  return (
    <section data-testid={`regime-headline-${asset}`} className="space-y-3">
      <h2
        data-testid="regime-headline"
        aria-live="polite"
        className="text-2xl font-semibold leading-snug text-text-primary"
      >
        {parts.map((p, i) => (
          <span key={`${p.key}-${i}`} className={i === 0 ? undefined : "inline-block"}>
            {i > 0 && locale === "en" ? " " : ""}
            {say(p)}
          </span>
        ))}
      </h2>
      {shock ? (
        <p
          data-testid="regime-shock"
          className="border-l-4 border-pillar-market bg-bg-secondary px-3 py-2 text-sm text-text-primary"
        >
          {say(shock)}
        </p>
      ) : null}
      <div
        role="group"
        aria-label={t("chip.groupLabel")}
        className="grid gap-2 sm:grid-cols-[1.25fr_1fr_1fr]"
      >
        {available.map((l) => {
          const c = chips[l]!;
          const pressed = l === layer;
          return (
            <button
              key={l}
              type="button"
              data-testid={`regime-chip-${l}`}
              aria-pressed={pressed}
              onClick={() => setPicked(l)}
              className={`rounded border px-3 py-2 text-left text-text-primary hover:border-pillar-market ${
                pressed ? "border-2 border-pillar-market" : "border-border-primary"
              }`}
            >
              <span className="block text-xs text-text-tertiary">{say(c.label)}</span>
              <span className="block text-base font-bold leading-snug">{say(c.value)}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
                {say(c.note)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-tertiary">{t("pickHint")}</p>
      {flip ? (
        <p data-testid="regime-flip-note" className="text-xs text-text-tertiary">
          {flip}
        </p>
      ) : null}
    </section>
  );
}
