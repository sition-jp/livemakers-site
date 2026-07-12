import jaMessages from "@/messages/ja.json";

import type {
  ArticleFamily,
  SeriesSlug,
} from "@/lib/articles/article-model";
import type { IndicatorTileCopy } from "@/components/home/IndicatorTileCard";
import type { LaneBlockCopy } from "@/components/home/LaneBlock";
import type { LeadArticleLabels } from "@/components/home/LeadArticleCard";
import type { LibraryShelfCopy } from "@/components/home/LibraryShelf";
import type { RadarObservationsCopy } from "@/components/home/RadarObservationsCard";
import type { RadarPromotedCopy } from "@/components/home/RadarPromotedCard";
import type { RecentSignalsCopy } from "@/components/home/RecentSignalsCard";
import type { SeriesIndexCopy } from "@/components/home/SeriesIndexCard";
import type { SessionFocusCopy } from "@/components/home/SessionFocusChart";
import type { SessionNowCopy } from "@/components/home/SessionNowCard";
import type { SessionScheduleCopy } from "@/components/home/SessionScheduleCard";
import type { TopMoversCopy } from "@/components/home/TopMoversCard";
import type { ProvenanceLabels } from "@/components/home/WindowProvenanceRow";
import type { LaneId } from "./instruments";

export interface HomeCopyContext {
  sessionName: string;
  nextSessionName: string;
  nextSessionTime: string;
  remainingSessions: number;
}

type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export interface HomeCopy {
  provenance: ProvenanceLabels;
  globalProvenanceNote: string;
  unavailable: string;
  noLiveSession: string;
  masthead: {
    title: string;
    subtitle: string;
  };
  sessionNow: SessionNowCopy;
  schedule: SessionScheduleCopy;
  focus: SessionFocusCopy;
  lead: LeadArticleLabels;
  seriesIndex: SeriesIndexCopy;
  mkt12: {
    groupTitle: string;
    groupSubtitle: string;
    sectionTitle: string;
    jointLabel: string;
    articleTitle: string;
    awaiting: string;
    previous: string;
    otherPeriods: string;
    archiveTitle: string;
    archiveSubtitle: string;
    indicator: IndicatorTileCopy;
    movers: TopMoversCopy;
  };
  radar: {
    sectionTitle: string;
    jointLabel: string;
    promoted: RadarPromotedCopy;
    observations: RadarObservationsCopy;
    recent: RecentSignalsCopy;
  };
  lanes: {
    titles: Record<LaneId, string>;
    subtitle: string;
    block: LaneBlockCopy;
  };
  library: {
    title: string;
    shelf: LibraryShelfCopy;
  };
}

export function buildHomeCopy(
  translate: Translator,
  context: HomeCopyContext,
): HomeCopy {
  const provenance = {
    review: translate("provenance.review"),
    source: translate("provenance.source"),
    asOf: translate("provenance.asOf"),
    packet: translate("provenance.packet"),
  };
  const familyLabels = Object.fromEntries(
    [
      "daily-intel",
      "signal",
      "deep-dive",
      "future-map",
      "mkt12-morning",
      "mkt12-weekend",
      "event-risk-radar",
      "weekly-brief",
      "session",
    ].map((family) => [family, translate(`family.${family}`)]),
  ) as Record<ArticleFamily, string>;
  const seriesLabels = Object.fromEntries(
    Object.entries(familyLabels).filter(([family]) => family !== "session"),
  ) as Record<SeriesSlug, string>;
  const laneLabels = {
    x_news_trends: translate("radar.lanes.xNews"),
    sde_phase1_breaking_radar: translate("radar.lanes.sde"),
    manual_operator_observation: translate("radar.lanes.checking"),
  };

  return {
    provenance,
    globalProvenanceNote: translate("provenance.note"),
    unavailable: translate("general.unavailable"),
    noLiveSession: translate("general.noLiveSession"),
    masthead: {
      title: translate("masthead.title"),
      subtitle: translate("masthead.subtitle"),
    },
    sessionNow: {
      sessionBadgeSuffix: translate("sessionNow.sessionBadgeSuffix"),
      freshnessPrefix: translate("sessionNow.freshnessPrefix"),
      nextUpdateLine: translate("sessionNow.nextUpdateLine", {
        name: context.nextSessionName,
        time: context.nextSessionTime,
      }),
      readFull: translate("sessionNow.readFull"),
      provenance,
    },
    schedule: {
      title: translate("schedule.title"),
      previous: translate("schedule.previous"),
      archive: translate("schedule.archive"),
      compactBadge: translate("schedule.compactBadge", {
        count: context.remainingSessions,
      }),
      compactPrevious: translate("schedule.compactPrevious"),
      focusPrefix: translate("schedule.focusPrefix"),
    },
    focus: {
      title: translate("focus.title"),
      snapshotBadge: translate("focus.snapshotBadge"),
      basePrefix: translate("focus.basePrefix"),
      description: translate("focus.description", {
        session: context.sessionName,
      }),
      provenance,
    },
    lead: {
      pending: translate("lead.pending"),
      pendingNote: translate("lead.pendingNote"),
      previous: translate("lead.previous"),
      family: familyLabels["daily-intel"],
    },
    seriesIndex: {
      title: translate("seriesIndex.title"),
      subtitle: translate("seriesIndex.subtitle"),
      listLabel: translate("seriesIndex.listLabel"),
      familyLabels: seriesLabels,
    },
    mkt12: {
      groupTitle: translate("mkt12.groupTitle"),
      groupSubtitle: translate("mkt12.groupSubtitle"),
      sectionTitle: translate("mkt12.sectionTitle"),
      jointLabel: translate("mkt12.jointLabel"),
      articleTitle: translate("mkt12.articleTitle"),
      awaiting: translate("mkt12.awaiting"),
      previous: translate("mkt12.previous"),
      otherPeriods: translate("mkt12.otherPeriods"),
      archiveTitle: translate("mkt12.archiveTitle"),
      archiveSubtitle: translate("mkt12.archiveSubtitle"),
      indicator: {
        title: translate("mkt12.indicator.title"),
        dataDatePrefix: translate("mkt12.indicator.dataDatePrefix"),
        snapshotBadge: translate("mkt12.indicator.snapshotBadge"),
        scrollHint: translate("mkt12.indicator.scrollHint"),
        regimeLabel: translate("mkt12.indicator.regimeLabel"),
        provenance,
      },
      movers: {
        title: translate("mkt12.movers.title"),
        subtitle: translate("mkt12.movers.subtitle"),
        provenance,
      },
    },
    radar: {
      sectionTitle: translate("radar.sectionTitle"),
      jointLabel: translate("radar.jointLabel"),
      promoted: {
        title: translate("radar.promoted.title"),
        subtitle: translate("radar.promoted.subtitle"),
        observedSuffix: translate("radar.promoted.observedSuffix"),
        publishedSuffix: translate("radar.promoted.publishedSuffix"),
        laneLabels,
      },
      observations: {
        title: translate("radar.observations.title"),
        note: translate("radar.observations.note"),
        laneLabels,
      },
      recent: {
        title: translate("radar.recent.title"),
        subtitle: translate("radar.recent.subtitle"),
        familyLabel: familyLabels.signal,
      },
    },
    lanes: {
      titles: {
        macro: translate("lanes.macro"),
        crypto: translate("lanes.crypto"),
        rwa: translate("lanes.rwa"),
      },
      subtitle: translate("lanes.subtitle"),
      block: { provenance, familyLabels },
    },
    library: {
      title: translate("library.title"),
      shelf: {
        familyLabels,
        archiveTitle: translate("library.archiveTitle"),
        archiveNote: translate("library.archiveNote"),
      },
    },
  };
}

function testTranslator(
  key: string,
  values: Record<string, string | number> = {},
): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (current, segment) =>
        typeof current === "object" && current !== null
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      jaMessages.home,
    );
  if (typeof value !== "string") {
    throw new Error(`missing home test copy: ${key}`);
  }
  return Object.entries(values).reduce(
    (text, [name, replacement]) =>
      text.replaceAll(`{${name}}`, String(replacement)),
    value,
  );
}

export function buildTestHomeCopy(): HomeCopy {
  return buildHomeCopy(testTranslator, {
    sessionName: "Asia Open Terminal",
    nextSessionName: "Europe Bridge Terminal",
    nextSessionTime: "12:03",
    remainingSessions: 3,
  });
}
