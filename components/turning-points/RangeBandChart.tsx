import { useId } from "react";
import { useTranslations } from "next-intl";

import {
  RANGE_BAND_LAYOUT as L,
  buildRangeBand,
  legendItems,
  upDownRows,
  type RangeBandOne,
} from "@/lib/pivots/range-band";
import type { AssetSymbol } from "@/lib/pivots/types";

export interface RangeBandChartProps {
  asset: AssetSymbol;
  band?: RangeBandOne | null;
  history?: { date: string; close: number }[];
}

const md = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
};

export function RangeBandChart({ asset, band, history = [] }: RangeBandChartProps) {
  const t = useTranslations("turningPoints.v2");
  const uid = useId();
  const legend = band ? legendItems(band) : [];
  if (!band || legend.length === 0) return null;

  const g = buildRangeBand(history, band);
  const b7 = legend.find((l) => l.id === "b7");
  const rows = upDownRows(band);
  const horizons = [...new Set(rows.map((r) => r.horizonDays))].sort((a, b) => a - b);
  const legendText = (l: (typeof legend)[number]) =>
    `${t("band.legendItem", { days: l.days, lo: l.lo, hi: l.hi, widthPct: l.widthPct })} ${t(
      "band.legendExit",
      { days: l.days, usualPct: l.usualPct, tenN: l.tenN },
    )}`;
  const bandOf = (id: "b7" | "b30") => g.bands.find((b) => b.id === id);
  const b30 = bandOf("b30");
  const b7box = bandOf("b7");
  const axisText = (k: "start" | "mid" | "today" | "end", date: string | null) =>
    k === "today" ? t("band.chart.today") : k === "end" ? t("band.chart.end") : date ? md(date) : "";

  return (
    <section data-testid={`range-band-${asset}`} className="space-y-3">
      <h3 className="text-lg font-medium text-text-primary">{t("band.heading")}</h3>
      <p className="text-sm text-text-secondary">{t("band.leadIn")}</p>
      {b7 ? (
        <p
          data-testid="range-band-oneline"
          className="border-l-4 border-pillar-market bg-bg-secondary px-3 py-2 text-text-primary"
        >
          {t("band.oneLine", { lo: b7.lo, hi: b7.hi, tenN: b7.tenN, usualPct: b7.usualPct })}
        </p>
      ) : null}
      <svg
        viewBox={`0 0 ${L.width} ${L.height}`}
        role="img"
        aria-labelledby={`${uid}-t ${uid}-d`}
        data-testid="range-band-svg"
        className="block h-auto w-full rounded text-text-primary"
      >
        <title id={`${uid}-t`}>{`${asset} ${t("band.chart.aria")}`}</title>
        <desc id={`${uid}-d`}>{legend.map(legendText).join(" ")}</desc>
        <rect
          x={g.futureBox.x}
          y={g.futureBox.y}
          width={g.futureBox.width}
          height={g.futureBox.height}
          fill="currentColor"
          className="text-text-tertiary"
          opacity={0.08}
        />
        {b30 ? (
          <rect
            data-testid="band-30"
            x={b30.x}
            y={b30.y}
            width={b30.width}
            height={b30.height}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={0.8}
            strokeDasharray="3 3"
            fillOpacity={0.12}
            className="text-pillar-market"
          />
        ) : null}
        {b7box ? (
          <rect
            data-testid="band-7"
            x={b7box.x}
            y={b7box.y}
            width={b7box.width}
            height={b7box.height}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={1}
            fillOpacity={0.3}
            className="text-pillar-market"
          />
        ) : null}
        {g.lines.leads.map((l) => (
          <line
            key={l.id}
            x1={l.x1}
            x2={l.x2}
            y1={l.y}
            y2={l.y}
            stroke="currentColor"
            strokeWidth={0.7}
            strokeDasharray="1 2"
            opacity={l.id === "now" ? 0.55 : 0.8}
            className={l.id === "now" ? "text-text-primary" : "text-pillar-market"}
          />
        ))}
        {b7box ? (
          <text x={b7box.x + 2} y={b7box.y - 4} fontSize={10.5} fontWeight={700} fill="currentColor" className="text-pillar-market">
            {t("band.chart.d7")}
          </text>
        ) : null}
        {b30 ? (
          <text x={b30.x + b30.width - 2} y={b30.y + 12} textAnchor="end" fontSize={10.5} fontWeight={700} fill="currentColor" className="text-pillar-market">
            {t("band.chart.d30")}
          </text>
        ) : null}
        {g.lines.price.length > 1 ? (
          <polyline
            points={g.lines.price.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        ) : null}
        <line
          x1={g.lines.today.x}
          x2={g.lines.today.x}
          y1={g.lines.today.y1}
          y2={g.lines.today.y2}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="2 2"
          className="text-text-tertiary"
        />
        <circle cx={g.todayDot.x} cy={g.todayDot.y} r={3.5} fill="currentColor" />
        {g.labels.map((lb) => (
          <text
            key={lb.id}
            x={lb.x}
            y={lb.textY}
            fontSize={10.5}
            fontWeight={lb.id === "now" ? 700 : 400}
            fill="currentColor"
            className={lb.id === "now" ? "text-text-primary" : "text-pillar-market"}
          >
            {lb.text}
          </text>
        ))}
        <line x1={g.axis.x1} x2={g.axis.x2} y1={g.axis.y} y2={g.axis.y} stroke="currentColor" opacity={0.3} className="text-text-tertiary" />
        {g.axis.ticks.map((tk) => (
          <text key={tk.kind} x={tk.x} y={g.axis.labelY} textAnchor={tk.anchor} fontSize={10.5} fill="currentColor" className="text-text-tertiary">
            {axisText(tk.kind, tk.date)}
          </text>
        ))}
        <text x={(L.left + L.todayX) / 2} y={L.captionY} textAnchor="middle" fontSize={10} fill="currentColor" className="text-text-tertiary">
          {t("band.chart.past")}
        </text>
        <text x={(L.todayX + L.futureRight) / 2} y={L.captionY} textAnchor="middle" fontSize={10} fill="currentColor" className="text-text-tertiary">
          {t("band.chart.future")}
        </text>
      </svg>
      <ul data-testid="range-band-legend" className="space-y-2 text-sm text-text-primary">
        {legend.map((l) => (
          <li key={l.id} data-testid={`legend-${l.id}`} className="flex gap-2">
            <i
              aria-hidden="true"
              className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-sm border border-pillar-market bg-pillar-market ${
                l.id === "b7" ? "bg-pillar-market/30" : "border-dashed bg-pillar-market/10"
              }`}
            />
            <span>
              {t("band.legendItem", { days: l.days, lo: l.lo, hi: l.hi, widthPct: l.widthPct })}
              <br />
              {t("band.legendExit", { days: l.days, usualPct: l.usualPct, tenN: l.tenN })}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-tertiary">{t("band.note")}</p>
      {rows.length > 0 ? (
        <details data-testid="range-band-updown" className="text-sm">
          <summary className="cursor-pointer font-semibold text-text-primary">{t("updown.summary")}</summary>
          <table className="mt-2 w-full border-collapse text-left text-sm text-text-secondary">
            <thead>
              <tr className="text-xs text-text-tertiary">
                <th className="py-1 pr-2 font-normal" />
                <th className="py-1 pr-2 font-normal">{t("updown.colUp")}</th>
                <th className="py-1 font-normal">{t("updown.colDown")}</th>
              </tr>
            </thead>
            <tbody>
              {horizons.map((h) => {
                const up = rows.find((r) => r.horizonDays === h && r.side === "up");
                const down = rows.find((r) => r.horizonDays === h && r.side === "down");
                return (
                  <tr key={h} className="border-t border-border-primary align-top">
                    <th className="py-1 pr-2 font-normal text-text-primary">{t("updown.rowDays", { horizonDays: h })}</th>
                    <td className="py-1 pr-2">
                      {up ? (
                        <>
                          {t("updown.cellUp", { widthPct: up.widthPct, price: up.price })}{" "}
                          <b className="text-text-primary">{up.usualPct}%</b>
                        </>
                      ) : null}
                    </td>
                    <td className="py-1">
                      {down ? (
                        <>
                          {t("updown.cellDown", { widthPct: down.widthPct, price: down.price })}{" "}
                          <b className="text-text-primary">{down.usualPct}%</b>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-text-tertiary">{t("updown.note")}</p>
        </details>
      ) : null}
    </section>
  );
}
