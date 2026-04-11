import { useTranslations } from "next-intl";
import type { TickerSnapshot } from "@/lib/types";

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

export function NetworkPulse({ snapshot }: { snapshot: TickerSnapshot }) {
  const t = useTranslations("overview");

  const cards = [
    {
      label: "PRICE",
      value: `$${snapshot.ada_price_usd.toFixed(4)}`,
      delta: `${snapshot.ada_change_24h >= 0 ? "+" : ""}${snapshot.ada_change_24h.toFixed(1)}%`,
      deltaUp: snapshot.ada_change_24h >= 0,
    },
    {
      label: "TVL",
      value: compactUsd(snapshot.cardano_tvl_usd),
      delta: `${snapshot.tvl_change_24h >= 0 ? "+" : ""}${snapshot.tvl_change_24h.toFixed(1)}%`,
      deltaUp: snapshot.tvl_change_24h >= 0,
    },
    {
      label: "STAKE",
      value: `${snapshot.stake_active_percent.toFixed(2)}%`,
      delta: "",
      deltaUp: true,
    },
    {
      label: "NAKA RANK",
      value: String(snapshot.naka_rank),
      delta: "",
      deltaUp: true,
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4 text-[10px] tracking-label text-text-tertiary">
        <span className="mr-2 text-pillar-overview">●</span>
        {t("networkPulse")}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="border border-border-primary bg-bg-secondary p-6"
          >
            <div className="mb-2 text-[10px] tracking-label text-text-tertiary">
              {card.label}
            </div>
            <div className="text-3xl font-bold">{card.value}</div>
            {card.delta && (
              <div
                className={
                  "mt-1 text-xs " +
                  (card.deltaUp ? "text-status-up" : "text-status-down")
                }
              >
                {card.delta}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
