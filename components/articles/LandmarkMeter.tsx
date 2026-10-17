import type { ReactNode } from "react";

import { LandmarkSparkline } from "@/components/articles/LandmarkSparkline";
import {
  formatLongDate,
  formatShortDate,
  type LandmarkRow,
} from "@/lib/landmark/meter-model";

/**
 * 節目の計器盤 (core spec 2026-10-16-lvm-landmark-meter-design §5)。サーバー部品・状態なし。
 * 色で良い・悪い・近い・遠いを表さない (札は灰色 1 色)。バーや針のような「近づいている」絵も使わない。
 * 言葉は messages の articles.landmarkMeter、数字は feed (SDE が整形した文字列) から。
 * 2026-10-17: ステーブルコインの 2 行と月足 MACD の下抜け (core spec 2026-10-17-lvm-landmark-meter-stablecoin-rows-design)。
 * 2026-10-17 夜: ETH 現物 ETF の行 (core spec 2026-10-17-lvm-landmark-meter-eth-etf-row-design・BTC の ETF と同じ組み立て)。
 * 2026-10-18: 各カードの名前の下に過去 2 年の推移グラフ (series があるときだけ・core spec
 * 2026-10-17-lvm-landmark-meter-sparkline-design)。グラフは補助で、カードの文字はグラフの有無で変えない。
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

const BAR_ROWS = new Set(["ma200w", "macd2w", "macd1m"]);

function nextCheckLine(row: LandmarkRow, t: LandmarkMeterTranslate): ReactNode {
  const item = row.item!;
  return item.nextCheck && BAR_ROWS.has(row.copyKey) ? (
    <p>{t(`rows.${row.copyKey}.armed`, { date: formatShortDate(item.nextCheck) })}</p>
  ) : null;
}

function firedCopyKey(row: LandmarkRow): string {
  if (row.copyKey !== "stableYoy") return `rows.${row.copyKey}.fired`;
  return row.item!.lastDirection === "negative" ? "rows.stableYoy.firedNegative" : "rows.stableYoy.firedPositive";
}

function stateLine(row: LandmarkRow, t: LandmarkMeterTranslate): ReactNode {
  const item = row.item!;
  const k = row.copyKey;
  switch (row.badge) {
    case "fired": {
      const date = item.lastEvent ?? item.barDate;
      const label = BAR_ROWS.has(k) ? formatShortDate(date) : formatLongDate(date);
      return (
        <p>
          <Badge>{t("badges.fired")}</Badge>
          {t(firedCopyKey(row), { date: label })}
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
        <>
          <p>
            <Badge>{t("badges.afterCross")}</Badge>
            {t(`rows.${k}.afterCross`)}
          </p>
          {/* 月足: 上抜けの後は上抜けは数えられないが、下抜けは次の確定足で判定される */}
          {item.dead && row.deadBadge === null && item.nextCheck ? (
            <p>{t("rows.macd1m.armedDead", { date: formatShortDate(item.nextCheck) })}</p>
          ) : null}
        </>
      );
    case "aboveZero":
      return (
        <p>
          <Badge>{t("badges.aboveZero")}</Badge>
          {t(`rows.${k}.aboveZero`)}
        </p>
      );
    default:
      return row.deadBadge === "fired" ? null : nextCheckLine(row, t);
  }
}

/** 月足 MACD の下抜け (feed に `dead` があるときだけ) */
function deadLine(row: LandmarkRow, t: LandmarkMeterTranslate): ReactNode {
  const dead = row.item!.dead;
  if (!dead) return null;
  if (row.deadBadge === "fired" && dead.lastEvent) {
    return (
      <p>
        <Badge>{t("badges.fired")}</Badge>
        {t("rows.macd1m.firedDead", { date: formatShortDate(dead.lastEvent) })}
      </p>
    );
  }
  if (row.deadBadge === "afterCross") {
    return (
      <p>
        <Badge>{t("badges.afterDeadCross")}</Badge>
        {t("rows.macd1m.afterDeadCross")}
      </p>
    );
  }
  return null;
}

/** 最高を持つ行 (BTC・ETH の ETF・ステーブルコイン総供給): いまの値が最高なら「まで 0」ではなく「いまの値が最高」 */
const PEAK_ROWS = new Set(["etf", "ethEtf", "stableAth"]);

function gapText(row: LandmarkRow, t: LandmarkMeterTranslate): string {
  const item = row.item!;
  if (!PEAK_ROWS.has(row.copyKey)) return t(`rows.${row.copyKey}.gap`, item.values);
  const peakDate = formatLongDate(item.values.peakDate);
  if (item.values.peakDate === item.barDate) return t(`rows.${row.copyKey}.gapAtPeak`, { peakDate });
  return t(`rows.${row.copyKey}.gap`, { ...item.values, peakDate });
}

function GapCell({ row, t }: { row: LandmarkRow; t: LandmarkMeterTranslate }) {
  const item = row.item!;
  return (
    <>
      <p className="text-text-primary">{gapText(row, t)}</p>
      {stateLine(row, t)}
      {deadLine(row, t)}
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
  if (row.copyKey === "macd1m") {
    return (
      <>
        <p>{t("rows.macd1m.last", { date: date(item.lastEvent), count: item.count })}</p>
        {item.dead ? (
          <p>{t("rows.macd1m.lastDead", { date: date(item.dead.lastEvent), count: item.dead.count })}</p>
        ) : null}
        <p className="text-text-tertiary">{t("rows.macd1m.count", { sinceYear: item.sinceYear })}</p>
      </>
    );
  }
  if (row.copyKey === "stableYoy" && item.lastEvent && item.lastDirection) {
    const key = item.lastDirection === "negative" ? "rows.stableYoy.lastNegative" : "rows.stableYoy.lastPositive";
    return (
      <>
        <p>{t(key, { date: formatLongDate(item.lastEvent) })}</p>
        <p className="text-text-tertiary">
          {t("rows.stableYoy.count", { sinceYear: item.sinceYear, count: item.count })}
        </p>
      </>
    );
  }
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

/** 条件を変えた指標 (registry.json の changes・v1 spec §6「条件の変更を隠さない」) */
const CHANGED_ROWS = new Set(["macd1m", "stableYoy", "stableAth"]);

export function LandmarkMeter({ rows, t }: { rows: LandmarkRow[]; t: LandmarkMeterTranslate }) {
  const unavailable = t("unavailable");
  // 注記の回数は表に出ている行から数える (固定の文字にしない)
  const counts = rows.flatMap((row) =>
    row.item
      ? [
          row.item.count,
          ...(row.item.recover ? [row.item.recover.count] : []),
          ...(row.item.dead ? [row.item.dead.count] : []),
        ]
      : [],
  );
  return (
    <section data-landmark-meter aria-labelledby="landmark-meter-title" className="mt-6">
      <h2 id="landmark-meter-title" className="text-lg font-bold text-text-primary">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">{t("lead")}</p>
      {rows.some((row) => row.item?.series) ? (
        <p data-landmark-chart-legend className="mt-1 text-[11px] leading-5 text-text-tertiary">
          {t("chartLegend")}
        </p>
      ) : null}
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
            {row.item?.series ? <LandmarkSparkline rowKey={row.key} series={row.item.series} /> : null}
            <dl className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5">
              <Cell label={t("columns.now")}>
                {row.item ? <NowCell row={row} t={t} /> : <p>{unavailable}</p>}
              </Cell>
              <Cell label={t("columns.condition")}>
                <p>{t(`rows.${row.copyKey}.condition`)}</p>
                {row.copyKey === "mvrv" ? <p>{t("rows.mvrv.conditionRecover")}</p> : null}
                {row.copyKey === "macd1m" && row.item?.dead ? <p>{t("rows.macd1m.conditionDead")}</p> : null}
                {CHANGED_ROWS.has(row.copyKey) ? (
                  <p className="text-text-tertiary">{t(`rows.${row.copyKey}.changed`)}</p>
                ) : null}
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
        <li>{t("notes.count", { min: Math.min(...counts), max: Math.max(...counts) })}</li>
        <li>{t("notes.fixed")}</li>
        <li>{t("notes.cooldown")}</li>
        <li>{t("notes.sources")}</li>
      </ul>
    </section>
  );
}
