import type { ReactNode } from "react";

import {
  REGION_MODULES,
  type GradientRegion,
} from "@/lib/home/gradient-ledger";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import type { HomeCompositionProps } from "../HomeComposition";
import { EventRiskCard } from "../EventRiskCard";
import { FlashPromotionCard } from "../FlashPromotionCard";
import { SessionFocusChart } from "../SessionFocusChart";
import { SessionNowCard } from "../SessionNowCard";
import { SessionScheduleCard } from "../SessionScheduleCard";

const REGION = "leading" satisfies GradientRegion;

/**
 * 左カラム = 先行 (G44 D5)。モジュール順は勾配台帳 REGION_MODULES.leading。
 * session-now は D8 の単一表現ルールで desktop 専用 (mobile は CompositeHero が担う)。
 * flash-promotion = FlashPromotionCard (昇格ペア or 空状態)・event-risk = EventRiskCard
 * (観測 title-only + 最新記事) を描画する。
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
>;

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
  copy,
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
          />
        ) : (
          <section className="rounded-lg border border-border-primary bg-bg-secondary p-4 text-sm text-text-tertiary">
            {copy.noLiveSession}
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
      case "flash-promotion":
        return (
          <FlashPromotionCard
            pair={slots.radarPair}
            copy={{
              sectionTitle: copy.radar.sectionTitle,
              promoted: copy.radar.promoted,
              emptyNote: copy.radar.observations.note,
              familyLabels: copy.familyLabels,
            }}
          />
        );
      case "event-risk":
        return (
          <EventRiskCard
            observations={slots.observing}
            latest={slots.eventRiskLatest}
            copy={{
              observations: copy.radar.observations,
              familyLabels: copy.familyLabels,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section data-ledger-group={REGION} className="min-w-0 space-y-6">
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
