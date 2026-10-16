import type { ReactNode } from "react";

import {
  formatLongDate,
  formatShortDate,
  type LandmarkRow,
} from "@/lib/landmark/meter-model";

/**
 * 節目の計器盤 (core spec 2026-10-16-lvm-landmark-meter-design §5)。サーバー部品・状態なし。
 * 色で良い・悪い・近い・遠いを表さない (札は灰色 1 色)。バーや針のような「近づいている」絵も使わない。
 * 言葉は messages の articles.landmarkMeter、数字は feed (SDE が整形した文字列) から。
 */
export type LandmarkMeterTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      data-landmark-badge
      className="mr-1.5 inline-block rounded-sm border border-border-primary px-1 font-mono text-[10px] leading-4 text-text-tertiary"
    >
      {children}
    </span>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 font-mono text-[10px] tracking-label text-text-tertiary">{label}</dt>
      <dd className="min-w-0 space-y-0.5 text-xs leading-5 text-text-secondary">{children}</dd>
    </>
  );
}

function NowCell({ row, t }: { row: LandmarkRow; t: LandmarkMeterTranslate }) {
  const item = row.item!;
  const asOf = t(`rows.${row.copyKey}.asOf`, { date: formatShortDate(item.barDate) });
  return (
    <p>
      <span className="text-text-primary">{t(`rows.${row.copyKey}.now`, item.values)}</span>
      （{row.staleEmphasis ? <strong className="font-bold text-text-primary">{asOf}</strong> : asOf}）
    </p>
  );
}

function stateLine(row: LandmarkRow, t: LandmarkMeterTranslate): ReactNode {
  const item = row.item!;
  const k = row.copyKey;
  switch (row.badge) {
    case "fired": {
      const date = item.lastEvent ?? item.barDate;
      const label = k === "ma200w" || k === "macd2w" || k === "macd1m" ? formatShortDate(date) : formatLongDate(date);
      return (
        <p>
          <Badge>{t("badges.fired")}</Badge>
          {t(`rows.${k}.fired`, { date: label })}
        </p>
      );
    }
    case "cooldown":
      return (
        <p>
          <Badge>{t("badges.cooldown")}</Badge>
          {t(`rows.${k}.cooldown`, { date: formatLongDate(item.eligibleFrom!) })}
        </p>
      );
    case "afterCross":
      return (
        <p>
          <Badge>{t("badges.afterCross")}</Badge>
          {t(`rows.${k}.afterCross`)}
        </p>
      );
    case "aboveZero":
      return (
        <p>
          <Badge>{t("badges.aboveZero")}</Badge>
          {t(`rows.${k}.aboveZero`)}
        </p>
      );
    default:
      return item.nextCheck && (k === "ma200w" || k === "macd2w" || k === "macd1m") ? (
        <p>{t(`rows.${k}.armed`, { date: formatShortDate(item.nextCheck) })}</p>
      ) : null;
  }
}

function GapCell({ row, t }: { row: LandmarkRow; t: LandmarkMeterTranslate }) {
  const item = row.item!;
  const values =
    row.copyKey === "etf" ? { ...item.values, peakDate: formatLongDate(item.values.peakDate) } : item.values;
  return (
    <>
      <p className="text-text-primary">{t(`rows.${row.copyKey}.gap`, values)}</p>
      {stateLine(row, t)}
      {row.recoverBadge === "waitingPremise" ? (
        <p>
          <Badge>{t("badges.waitingPremise")}</Badge>
          {t("rows.mvrv.waitingPremise")}
        </p>
      ) : null}
      {row.recoverBadge === "fired" && item.recover?.lastEvent ? (
        <p>
          <Badge>{t("badges.fired")}</Badge>
          {t("rows.mvrv.recoverFired", { date: formatLongDate(item.recover.lastEvent) })}
        </p>
      ) : null}
    </>
  );
}

function LastCell({ row, t }: { row: LandmarkRow; t: LandmarkMeterTranslate }) {
  const item = row.item!;
  const date = (iso: string | null) => (iso ? formatLongDate(iso) : t("never"));
  if (row.copyKey === "mvrv") {
    return (
      <>
        <p>{t("rows.mvrv.last", { date: date(item.lastEvent), count: item.count })}</p>
        {item.recover ? (
          <p>{t("rows.mvrv.lastRecover", { date: date(item.recover.lastEvent), count: item.recover.count })}</p>
        ) : null}
        <p className="text-text-tertiary">{t("rows.mvrv.count", { sinceYear: item.sinceYear })}</p>
      </>
    );
  }
  return (
    <>
      <p>{date(item.lastEvent)}</p>
      <p className="text-text-tertiary">
        {t(`rows.${row.copyKey}.count`, { sinceYear: item.sinceYear, count: item.count })}
      </p>
    </>
  );
}

export function LandmarkMeter({ rows, t }: { rows: LandmarkRow[]; t: LandmarkMeterTranslate }) {
  const unavailable = t("unavailable");
  return (
    <section data-landmark-meter aria-labelledby="landmark-meter-title" className="mt-6">
      <h2 id="landmark-meter-title" className="text-lg font-bold text-text-primary">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">{t("lead")}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <li
            key={row.key}
            data-landmark-row={row.copyKey}
            className="min-w-0 rounded-sm border border-border-primary p-3"
          >
            <p className="text-sm font-bold text-text-primary">
              {t(`rows.${row.copyKey}.name`)}
              <span className="ml-2 text-[11px] font-normal text-text-tertiary">{t(`rows.${row.copyKey}.unit`)}</span>
            </p>
            <dl className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5">
              <Cell label={t("columns.now")}>
                {row.item ? <NowCell row={row} t={t} /> : <p>{unavailable}</p>}
              </Cell>
              <Cell label={t("columns.condition")}>
                <p>{t(`rows.${row.copyKey}.condition`)}</p>
                {row.copyKey === "mvrv" ? <p>{t("rows.mvrv.conditionRecover")}</p> : null}
                {row.copyKey === "macd1m" ? <p className="text-text-tertiary">{t("rows.macd1m.changed")}</p> : null}
              </Cell>
              <Cell label={t("columns.gap")}>
                {row.item ? <GapCell row={row} t={t} /> : <p>{unavailable}</p>}
              </Cell>
              <Cell label={t("columns.last")}>
                {row.item ? <LastCell row={row} t={t} /> : <p>{unavailable}</p>}
              </Cell>
            </dl>
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1 text-[11px] leading-5 text-text-tertiary">
        <li>{t("notes.count")}</li>
        <li>{t("notes.fixed")}</li>
        <li>{t("notes.cooldown")}</li>
        <li>{t("notes.sources")}</li>
      </ul>
    </section>
  );
}
