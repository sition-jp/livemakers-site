import type {
  ArticleFamily,
  ArticleMeta,
} from "@/lib/articles/article-model";
import type { InstrumentId, LaneId } from "@/lib/home/instruments";
import { marketDirectionClass } from "@/lib/home/market-direction";
import type { MarketDirection } from "@/lib/home/market-snapshot";
import type { WindowProvenance } from "@/lib/provenance/window-provenance";
import { ArticleRow } from "./ArticleRow";
import {
  WindowProvenanceRow,
  type ProvenanceLabels,
} from "./WindowProvenanceRow";

export interface LaneValueRow {
  instrumentId: InstrumentId;
  nameJa: string;
  value: string | null;
  changeLabel: string | null;
  direction: MarketDirection | null;
}

export interface LaneBlockCopy {
  provenance: ProvenanceLabels;
  familyLabels: Record<ArticleFamily, string>;
}

const LANE_COLORS: Record<LaneId, string> = {
  macro: "var(--color-lane-macro, var(--color-accent))",
  crypto: "var(--color-lane-crypto, var(--color-accent))",
  rwa: "var(--color-lane-rwa, var(--color-accent))",
};

export function LaneBlock({
  lane,
  title,
  subtitle,
  rows,
  articles,
  asOfLabel,
  provenance,
  copy,
}: {
  lane: LaneId;
  title: string;
  subtitle: string;
  rows: readonly LaneValueRow[];
  articles: ArticleMeta[];
  asOfLabel: string;
  provenance: WindowProvenance;
  copy: LaneBlockCopy;
}) {
  const laneColor = LANE_COLORS[lane];
  return (
    <section className="h-full rounded-lg border border-border-primary bg-bg-secondary p-4">
      <header
        className="border-l-4 pl-3"
        style={{ borderColor: laneColor }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
          <span className="ml-auto font-mono text-[9px] text-text-tertiary">
            {asOfLabel}
          </span>
        </div>
        {subtitle ? (
          <p className="mt-1 text-[11px] text-text-tertiary">{subtitle}</p>
        ) : null}
      </header>
      <div className="mt-3 divide-y divide-border-primary">
        {rows.map((row) => (
          <div
            key={row.instrumentId}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 text-xs"
          >
            <span className="font-semibold text-text-secondary">
              {row.nameJa}
            </span>
            <span className="font-mono font-bold text-text-primary">
              {row.value ?? "—"}
            </span>
            <span
              className={`min-w-14 text-right font-mono text-[10px] ${marketDirectionClass(row.direction)}`}
            >
              {row.changeLabel ?? "—"}
            </span>
          </div>
        ))}
      </div>
      {articles.length > 0 ? (
        <div className="mt-4 border-t border-border-primary">
          {articles.slice(0, 2).map((article) => (
            <ArticleRow
              key={article.articleId}
              article={article}
              familyLabel={copy.familyLabels[article.family]}
            />
          ))}
        </div>
      ) : null}
      <WindowProvenanceRow provenance={provenance} labels={copy.provenance} />
    </section>
  );
}
