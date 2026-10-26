import type { ReactNode } from "react";

import {
  REGION_MODULES,
  type GradientRegion,
} from "@/lib/home/gradient-ledger";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import type { HomeCompositionProps } from "../HomeComposition";
import { EventRiskModule } from "../EventRiskModule";
import { FlashListCard } from "../FlashListCard";
import { MobileLeadCard, MobileMkt12Card } from "../MobileMorningCards";
import { SessionFocusChart } from "../SessionFocusChart";
import { SessionNowCard } from "../SessionNowCard";
import { SessionScheduleCard } from "../SessionScheduleCard";

const REGION = "leading" satisfies GradientRegion;

/**
 * 左カラム = 先行 (G44 D5 / 2026-08-14 Phase 3 改訂)。モジュール順は勾配台帳
 * REGION_MODULES.leading。session-now・schedule はスマホも同じ部品 (2026-10-26)。
 * lead-card-mobile / mkt12-card-mobile = スマホ専用の Daily Intel・12指標カード
 * (focus 直下・PC は中央列の 2 欄)。
 * event-risk = 最新 event-risk-radar 記事 1 本 (focus 直下・desktop 専用 — mobile は
 * 右列の event-risk-mobile)・flash-list = 当日+前日の速報記事 (event-risk 直下) を描画する。
 * 2026-08-23 田平氏 GO: flash-promotion (昇格ペア) は撤去 — 公開以来一度も
 * ペアが成立しなかった空カード (spec 2026-08-23-terminal-switching-ux-design §D)。
 * 2026-10-09 田平氏 GO (案 A): 観測リスト (radar-observations) を速報リストへ置き換え。
 * 2026-10-09 田平氏 GO: focus を schedule 直下へ (順序の正本は台帳)。
 * session-now は live → live card / recentClosed → closed card / なし → fallback。
 */
export type LeadingColumnProps = Pick<
  HomeCompositionProps,
  | "live"
  | "schedule"
  | "slots"
  | "focusSeries"
  | "focusSessionSlug"
  | "sessionProvenance"
  | "copy"
  | "showSessionEditorial"
> &
  Partial<
    Pick<HomeCompositionProps, "recentClosed" | "recentClosedProvenance" | "locale">
  >;

// 2026-10-26 田平氏 GO: session-now・schedule はスマホも PC と同じ部品で出す。
// Daily Intel・12指標のカードはスマホ専用 (PC は中央の 2 欄)・event-risk は PC 専用
// (スマホは右列の event-risk-mobile)。
const MODULE_CLASSNAMES: Readonly<Record<string, string>> = {
  focus: "hidden md:block",
  "lead-card-mobile": "xl:hidden",
  "mkt12-card-mobile": "xl:hidden",
  "event-risk": "hidden xl:block",
};

export function LeadingColumn({
  live,
  schedule,
  slots,
  focusSeries,
  focusSessionSlug,
  sessionProvenance,
  recentClosed = null,
  recentClosedProvenance = null,
  copy,
  showSessionEditorial = true,
  locale = "ja",
}: LeadingColumnProps) {
  const sessionName = focusSessionSlug
    ? getSessionBySlug(focusSessionSlug).nameEn
    : copy.noLiveSession;

  const renderModule = (module: string): ReactNode => {
    switch (module) {
      case "session-now":
        return live && sessionProvenance ? (
          <SessionNowCard
            record={live}
            provenance={sessionProvenance}
            copy={copy.sessionNow}
            showEditorial={showSessionEditorial}
          />
        ) : recentClosed && recentClosedProvenance ? (
          <SessionNowCard
            record={recentClosed}
            provenance={recentClosedProvenance}
            copy={copy.sessionNow}
            showEditorial={showSessionEditorial}
            variant="closed"
          />
        ) : (
          <section className="rounded-lg border border-border-primary bg-bg-secondary p-4 text-sm text-text-tertiary">
            <p>{copy.noLiveSession}</p>
            <p className="mt-1 font-mono text-[11px]">
              {copy.sessionNow.nextUpdateLine}
            </p>
          </section>
        );
      case "schedule":
        // 2026-10-26 田平氏 GO: スマホも PC と同じ全行 (旧 compact は 1 行で
        // 情報が少なく、セッション名も読めなかった)
        return <SessionScheduleCard schedule={schedule} copy={copy.schedule} />;
      case "lead-card-mobile":
        return <MobileLeadCard lead={slots.lead} copy={copy} />;
      case "mkt12-card-mobile":
        return <MobileMkt12Card mkt12={slots.mkt12} copy={copy} />;
      case "focus":
        return (
          <SessionFocusChart
            sessionName={sessionName}
            series={focusSeries}
            unavailableLabel={copy.unavailable}
            copy={copy.focus}
          />
        );
      case "event-risk":
        return (
          <EventRiskModule
            article={slots.eventRiskLatest}
            familyLabels={copy.familyLabels}
          />
        );
      case "flash-list":
        return (
          <FlashListCard
            articles={slots.flashRecent}
            copy={copy.flashList}
            locale={locale}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section data-ledger-group={REGION} className="min-w-0 space-y-6">
      <h2 className="text-xs font-bold uppercase tracking-label text-text-tertiary">
        {copy.intelligenceTerminal}
      </h2>
      {REGION_MODULES[REGION].map((module) => (
        <div
          key={module}
          data-column-module={module}
          className={MODULE_CLASSNAMES[module]}
        >
          {renderModule(module)}
        </div>
      ))}
    </section>
  );
}
