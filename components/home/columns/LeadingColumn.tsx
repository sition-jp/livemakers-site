import type { ReactNode } from "react";

import {
  REGION_MODULES,
  type GradientRegion,
} from "@/lib/home/gradient-ledger";
import eventRiskSchedule from "@/data/home/event-risk-schedule.json";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import type { HomeCompositionProps } from "../HomeComposition";
import { ArticleCardSmall } from "../ArticleCardSmall";
import { RadarObservationsCard } from "../RadarObservationsCard";
import { SessionFocusChart } from "../SessionFocusChart";
import { SessionNowCard } from "../SessionNowCard";
import { SessionScheduleCard } from "../SessionScheduleCard";

const REGION = "leading" satisfies GradientRegion;

/**
 * 左カラム = 先行 (G44 D5 / 2026-08-14 Phase 3 改訂)。モジュール順は勾配台帳
 * REGION_MODULES.leading。session-now は D8 の単一表現ルールで desktop 専用
 * (mobile は CompositeHero が担う)。event-risk = 最新 event-risk-radar 記事 1 本
 * (schedule 直下)・radar-observations = 観測リスト (event-risk 直下) を描画する。
 * 2026-08-23 田平氏 GO: flash-promotion (昇格ペア) は撤去 — 公開以来一度も
 * ペアが成立しなかった空カード (spec 2026-08-23-terminal-switching-ux-design §D)。
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
  Partial<Pick<HomeCompositionProps, "recentClosed" | "recentClosedProvenance">>;

const MODULE_CLASSNAMES: Readonly<Record<string, string>> = {
  "session-now": "hidden xl:block",
  focus: "hidden md:block",
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
        return (
          <>
            <div className="md:hidden">
              <SessionScheduleCard
                schedule={schedule}
                copy={copy.schedule}
                variant="compact"
              />
            </div>
            <div className="hidden md:block">
              <SessionScheduleCard schedule={schedule} copy={copy.schedule} />
            </div>
          </>
        );
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
        // Phase 3b (2026-08-14): サムネは 32:9 (16:9 の半分)・カード下に
        // 「確定イベント」週次リスト (data/home/event-risk-schedule.json —
        // 更新は ERR writer レーンの週次改訂に載せる)
        return (
          <div className="space-y-3">
            {slots.eventRiskLatest ? (
              <ArticleCardSmall
                article={slots.eventRiskLatest}
                familyLabel={copy.familyLabels[slots.eventRiskLatest.family]}
                thumbVariant="shortWide"
              />
            ) : null}
            <section
              data-event-risk-schedule
              className="rounded-lg border border-border-primary bg-bg-secondary p-4"
            >
              <h3 className="text-sm font-bold text-text-primary">
                {eventRiskSchedule.heading}
                <span className="ml-2 font-mono text-[10px] font-normal text-text-tertiary">
                  {eventRiskSchedule.weekLabel}
                </span>
              </h3>
              <ul className="mt-2 space-y-1.5">
                {eventRiskSchedule.events.map((event) => (
                  <li
                    key={event}
                    className="text-xs leading-relaxed text-text-secondary"
                  >
                    {event}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        );
      case "radar-observations":
        return (
          <RadarObservationsCard
            observations={slots.observing}
            copy={copy.radar.observations}
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
