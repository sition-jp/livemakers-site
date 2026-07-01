import { readerTerminalPublicAdapterFixture } from "@/lib/livemakers-terminal-adapter/reader-terminal-public-fixture";
import type {
  TerminalAdapterModule,
  TerminalAdapterPacket,
  TerminalAdapterSource,
} from "@/lib/livemakers-terminal-adapter/types";
import { TerminalAdapterPacketSchema } from "@/lib/livemakers-terminal-adapter/types";
import { findForbiddenTerminalVisibleTerms } from "@/lib/livemakers-terminal-adapter/visible-copy-safety";
import { terminalPreviewMock } from "./mock-data";
import type {
  LocalizedText,
  TerminalPreviewMock,
  TerminalPreviewModuleContract,
  TerminalSourceLedgerItem,
} from "./types";

function payloadText(
  payload: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function localizeFromPayload(
  payload: Record<string, unknown>,
  enKey: string,
  jaKey: string,
  fallback: LocalizedText,
): LocalizedText {
  return {
    en: payloadText(payload, enKey, fallback.en),
    ja: payloadText(payload, jaKey, fallback.ja),
  };
}

function payloadStringArray(
  payload: Record<string, unknown>,
  key: string,
): string[] {
  const value = payload[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function toPreviewDataFamily(
  dataFamily: TerminalAdapterModule["data_family"],
): TerminalPreviewModuleContract["dataFamily"] {
  if (dataFamily === "internal_sde_state" || dataFamily === "other") {
    return "editorial";
  }

  return dataFamily;
}

function checkedTrue(value: boolean, label: string): true {
  if (value !== true) {
    throw new Error(`Adapter fixture coupling check is not true: ${label}`);
  }

  return true;
}

type TerminalPreviewFixtureFamily =
  | "scheduled_session"
  | "breaking_radar"
  | "generic_fixture";

interface TerminalPreviewIndicatorFallback {
  id: string;
  label: string;
  value: string;
  note: LocalizedText;
  family: TerminalPreviewModuleContract["dataFamily"];
}

interface TerminalPreviewCopyProfile {
  terminalStateFallback?: {
    label: LocalizedText;
    summary: LocalizedText;
  };
  indicatorFallback?: TerminalPreviewIndicatorFallback;
  developmentSourceNote: LocalizedText;
  watchItemBody: LocalizedText;
  scenarios: TerminalPreviewMock["scenarios"];
  featuredBriefFallback?: TerminalPreviewMock["featuredBrief"];
}

const scheduledSessionScenarios: TerminalPreviewMock["scenarios"] = [
  {
    id: "base",
    title: {
      en: "Review queue continues",
      ja: "確認キュー継続",
    },
    body: {
      en: "Displayable source checks remain separated from fixture provenance while scheduled-session review continues.",
      ja: "scheduled-session確認中も、表示可能なソース確認とフィクスチャ来歴を分けて扱います。",
    },
    invalidation: {
      en: "Invalidated if source freshness fails or visible modules are blocked.",
      ja: "ソース鮮度が落ちる、または表示moduleがブロックされた場合は無効化します。",
    },
  },
  {
    id: "risk",
    title: {
      en: "Source refresh remains incomplete",
      ja: "ソース再確認が未完了",
    },
    body: {
      en: "If direct source refresh is not cleared, the material stays terminal-only and does not move toward publication.",
      ja: "直接ソース確認が完了しない場合、この素材はターミナル内に留め、公開方向へ進めません。",
    },
    invalidation: {
      en: "Invalidated when displayable public or mock sources pass review.",
      ja: "表示可能な公開またはmockソースが確認を通過した場合は無効化します。",
    },
  },
  {
    id: "alt",
    title: {
      en: "Source refresh clears",
      ja: "ソース再確認が通過",
    },
    body: {
      en: "If official wording is confirmed, the candidate can move to deeper editorial review.",
      ja: "公式表現が確認できた場合、候補素材は編集レビューの深掘りへ進めます。",
    },
    invalidation: {
      en: "Invalidated if wording or provenance cannot be verified.",
      ja: "表現または来歴を確認できない場合は無効化します。",
    },
  },
];

const breakingRadarScenarios: TerminalPreviewMock["scenarios"] = [
  {
    id: "base",
    title: {
      en: "Radar review continues",
      ja: "Radar確認継続",
    },
    body: {
      en: "Displayable radar candidates remain separated from fixture provenance while source checks continue.",
      ja: "ソース確認中も、表示可能なRadar候補とフィクスチャ来歴を分けて扱います。",
    },
    invalidation: {
      en: "Invalidated if source freshness fails or visible modules are blocked.",
      ja: "ソース鮮度が落ちる、または表示moduleがブロックされた場合は無効化します。",
    },
  },
  {
    id: "risk",
    title: {
      en: "Source refresh remains incomplete",
      ja: "ソース再確認が未完了",
    },
    body: {
      en: "If direct source refresh is not cleared, radar candidates stay terminal-only and do not move toward publication.",
      ja: "直接ソース確認が完了しない場合、Radar候補はターミナル内に留め、公開方向へ進めません。",
    },
    invalidation: {
      en: "Invalidated when displayable mock sources pass review.",
      ja: "表示可能なmockソースが確認を通過した場合は無効化します。",
    },
  },
  {
    id: "alt",
    title: {
      en: "Source refresh clears",
      ja: "ソース再確認が通過",
    },
    body: {
      en: "If source wording is confirmed, a candidate can move to deeper editorial review.",
      ja: "ソース文言が確認できた場合、候補素材は編集レビューの深掘りへ進めます。",
    },
    invalidation: {
      en: "Invalidated if wording or provenance cannot be verified.",
      ja: "表現または来歴を確認できない場合は無効化します。",
    },
  },
];

const scheduledSessionCopyProfile: TerminalPreviewCopyProfile = {
  developmentSourceNote: {
    en: "Fixture-only scheduled-session source note",
    ja: "フィクスチャ専用scheduled-sessionソース注記",
  },
  watchItemBody: {
    en: "Fixture-only scheduled-session review item; not ready for publication.",
    ja: "フィクスチャ専用のscheduled-session確認項目です。公開判断ではありません。",
  },
  scenarios: scheduledSessionScenarios,
};

const breakingRadarCopyProfile: TerminalPreviewCopyProfile = {
  terminalStateFallback: {
    label: {
      en: "Breaking Radar review queue",
      ja: "Breaking Radar確認キュー",
    },
    summary: {
      en: "Fixture radar candidates are grouped for source review before editorial use.",
      ja: "フィクスチャRadar候補を、編集利用前のソース確認用にまとめています。",
    },
  },
  indicatorFallback: {
    id: "breaking_radar.review_state",
    label: "Radar",
    value: "review",
    note: {
      en: "Displayable radar candidates remain under source review.",
      ja: "表示可能なRadar候補はソース確認中です。",
    },
    family: "editorial",
  },
  developmentSourceNote: {
    en: "Fixture-only Breaking Radar source note",
    ja: "フィクスチャ専用Breaking Radarソース注記",
  },
  watchItemBody: {
    en: "Fixture-only Breaking Radar review item; not ready for publication.",
    ja: "フィクスチャ専用のBreaking Radar確認項目です。公開判断ではありません。",
  },
  scenarios: breakingRadarScenarios,
  featuredBriefFallback: {
    title: {
      en: "Radar source discipline",
      ja: "Radarソース規律",
    },
    summary: {
      en: "Displayable fixture sources stay separated from internal snapshot provenance.",
      ja: "表示可能なフィクスチャソースと内部snapshot来歴を分けて扱います。",
    },
    status: "mock_draft",
  },
};

function fixtureFamilyFromPacket(
  packet: TerminalAdapterPacket,
): TerminalPreviewFixtureFamily {
  if (packet.packet_id.startsWith("fixture.breaking_radar_adapter.")) {
    return "breaking_radar";
  }

  if (packet.packet_id.startsWith("fixture.scheduled_session_visibility.")) {
    return "scheduled_session";
  }

  return "generic_fixture";
}

function copyProfileForFixtureFamily(
  family: TerminalPreviewFixtureFamily,
): TerminalPreviewCopyProfile {
  if (family === "breaking_radar") {
    return breakingRadarCopyProfile;
  }

  return scheduledSessionCopyProfile;
}

function isPreviewDisplayableSource(source: TerminalAdapterSource): boolean {
  return (
    source.public_display_allowed === true &&
    (source.source_visibility === "public" || source.source_visibility === "mock")
  );
}

function isPreviewDisplayableModule(module: TerminalAdapterModule): boolean {
  return (
    (module.module_status === "ready" || module.module_status === "degraded") &&
    (module.public_display_safety === "approved" ||
      module.public_display_safety === "needs_review") &&
    module.source_confidence !== "internal_only" &&
    module.display_surface !== "boundary_note"
  );
}

function toPreviewModule(
  module: TerminalAdapterModule,
  packet: TerminalAdapterPacket,
): TerminalPreviewModuleContract {
  return {
    moduleId: module.module_id,
    displaySurface: module.display_surface,
    dataFamily: toPreviewDataFamily(module.data_family),
    sourceKind: "fixture_only",
    sourceConfidence: "mock",
    contentKind: module.content_kind,
    publicDisplaySafety: "mock_only",
    nullPolicy: "unavailable_not_zero",
    realDataConnection: false,
    prohibitedCouplingsChecked: {
      tradingSignal: checkedTrue(
        packet.safety.prohibited_couplings_checked.trading_signal,
        "trading_signal",
      ),
      orderInstruction: checkedTrue(
        packet.safety.prohibited_couplings_checked.order_instruction,
        "order_instruction",
      ),
      paperLive: checkedTrue(
        packet.safety.prohibited_couplings_checked.paper_live,
        "paper_live",
      ),
      atFeedback: checkedTrue(
        packet.safety.prohibited_couplings_checked.at_feedback,
        "at_feedback",
      ),
      secrets: checkedTrue(
        packet.safety.prohibited_couplings_checked.secrets,
        "secrets",
      ),
    },
  };
}

function toPreviewSourceLedgerItem(
  source: TerminalAdapterSource,
): TerminalSourceLedgerItem {
  return {
    id: source.source_id,
    confidence: "fixture_only",
    label: {
      en: source.source_name,
      ja: source.source_name,
    },
    limitation: {
      en: source.limitations_en,
      ja: source.limitations_ja,
    },
  };
}

function parseTerminalAdapterPacket(packet: TerminalAdapterPacket): TerminalAdapterPacket {
  const result = TerminalAdapterPacketSchema.safeParse(packet);

  if (!result.success) {
    throw new Error(
      `Invalid terminal adapter packet: ${JSON.stringify(result.error.format())}`,
    );
  }

  return result.data;
}

function assertNoForbiddenVisibleCopy(packet: TerminalAdapterPacket): void {
  const matches = findForbiddenTerminalVisibleTerms(packet);

  if (matches.length > 0) {
    throw new Error(
      `Forbidden terminal visible copy: ${matches
        .map((match) => match.text)
        .join(", ")}`,
    );
  }
}

function terminalStateFromModules(
  modules: TerminalAdapterModule[],
  packet: TerminalAdapterPacket,
  base: TerminalPreviewMock,
  copyProfile: TerminalPreviewCopyProfile,
): TerminalPreviewMock["terminalState"] {
  const marketStateModule = modules.find(
    (module) => module.display_surface === "market_state_header",
  );

  return {
    posture: base.terminalState.posture,
    asOfJst: packet.as_of_jst ?? packet.generated_at,
    label: localizeFromPayload(
      marketStateModule?.payload ?? {},
      "label_en",
      "label_ja",
      copyProfile.terminalStateFallback?.label ?? base.terminalState.label,
    ),
    summary: localizeFromPayload(
      marketStateModule?.payload ?? {},
      "summary_en",
      "summary_ja",
      copyProfile.terminalStateFallback?.summary ?? base.terminalState.summary,
    ),
  };
}

function confidenceFromModule(
  module: TerminalAdapterModule,
): TerminalPreviewMock["developments"][number]["confidence"] {
  if (module.public_display_safety === "needs_review") {
    return "watch";
  }

  if (
    module.module_status === "ready" &&
    module.public_display_safety === "approved"
  ) {
    return "confirmed";
  }

  return "reported";
}

function indicatorFromMarketStateModule(
  module: TerminalAdapterModule,
  base: TerminalPreviewMock,
): TerminalPreviewMock["indicators"][number] {
  return {
    id: module.module_id,
    label: "Session",
    value: "review",
    note: localizeFromPayload(
      module.payload,
      "summary_en",
      "summary_ja",
      base.terminalState.summary,
    ),
    family: toPreviewDataFamily(module.data_family),
    freshness: "fixture_only",
  };
}

function indicatorsFromModules(
  modules: TerminalAdapterModule[],
  base: TerminalPreviewMock,
  copyProfile: TerminalPreviewCopyProfile,
): TerminalPreviewMock["indicators"] {
  const marketStateModule = modules.find(
    (module) => module.display_surface === "market_state_header",
  );

  if (!marketStateModule) {
    if (copyProfile.indicatorFallback && modules.length > 0) {
      return [
        {
          id: copyProfile.indicatorFallback.id,
          label: copyProfile.indicatorFallback.label,
          value: copyProfile.indicatorFallback.value,
          note: copyProfile.indicatorFallback.note,
          family: copyProfile.indicatorFallback.family,
          freshness: "fixture_only",
        },
      ];
    }

    return base.indicators;
  }

  return [indicatorFromMarketStateModule(marketStateModule, base)];
}

function developmentFromModule(
  module: TerminalAdapterModule,
  copyProfile: TerminalPreviewCopyProfile,
): TerminalPreviewMock["developments"][number] {
  const fallback = {
    en: module.unavailable.display_label_en,
    ja: module.unavailable.display_label_ja,
  };

  return {
    id: module.module_id,
    label: localizeFromPayload(module.payload, "label_en", "label_ja", fallback),
    summary: localizeFromPayload(
      module.payload,
      "summary_en",
      "summary_ja",
      fallback,
    ),
    confidence: confidenceFromModule(module),
    sourceNote: copyProfile.developmentSourceNote,
  };
}

function developmentsFromModules(
  modules: TerminalAdapterModule[],
  base: TerminalPreviewMock,
  copyProfile: TerminalPreviewCopyProfile,
): TerminalPreviewMock["developments"] {
  const developments = modules
    .filter((module) => module.display_surface === "what_happened")
    .map((module) => developmentFromModule(module, copyProfile));

  return developments.length > 0 ? developments : base.developments;
}

const watchItemHorizons: Array<TerminalPreviewMock["watchItems"][number]["horizon"]> =
  ["24h", "48-72h", "weekly"];

function watchItemsFromModule(
  module: TerminalAdapterModule,
  copyProfile: TerminalPreviewCopyProfile,
): TerminalPreviewMock["watchItems"] {
  const items = payloadStringArray(module.payload, "items");
  const itemsJa = payloadStringArray(module.payload, "items_ja");

  return items.map((item, index) => ({
    id: `${module.module_id}.${index}`,
    horizon: watchItemHorizons[index] ?? "weekly",
    title: {
      en: item,
      ja: itemsJa[index] ?? item,
    },
    body: copyProfile.watchItemBody,
  }));
}

function watchItemsFromModules(
  modules: TerminalAdapterModule[],
  base: TerminalPreviewMock,
  copyProfile: TerminalPreviewCopyProfile,
): TerminalPreviewMock["watchItems"] {
  const watchItems = modules
    .filter((module) => module.display_surface === "leading_indicators")
    .flatMap((module) => watchItemsFromModule(module, copyProfile));

  return watchItems.length > 0 ? watchItems : base.watchItems;
}

function scenariosFromDisplayableContext(
  modules: TerminalAdapterModule[],
  base: TerminalPreviewMock,
  copyProfile: TerminalPreviewCopyProfile,
): TerminalPreviewMock["scenarios"] {
  const hasDisplayableScheduledContext = modules.some((module) =>
    [
      "market_state_header",
      "what_happened",
      "leading_indicators",
      "source_ledger",
    ].includes(module.display_surface),
  );

  if (!hasDisplayableScheduledContext) {
    return base.scenarios;
  }

  return copyProfile.scenarios;
}

function featuredBriefFromModules(
  modules: TerminalAdapterModule[],
  base: TerminalPreviewMock,
  copyProfile: TerminalPreviewCopyProfile,
): TerminalPreviewMock["featuredBrief"] {
  const sourceLedgerModule = modules.find(
    (module) => module.display_surface === "source_ledger",
  );

  if (!sourceLedgerModule) {
    return copyProfile.featuredBriefFallback ?? base.featuredBrief;
  }

  return {
    title: localizeFromPayload(
      sourceLedgerModule.payload,
      "label_en",
      "label_ja",
      base.featuredBrief.title,
    ),
    summary: localizeFromPayload(
      sourceLedgerModule.payload,
      "summary_en",
      "summary_ja",
      base.featuredBrief.summary,
    ),
    status: "mock_draft",
  };
}

export function buildTerminalPreviewMockFromAdapterFixture(
  packet: TerminalAdapterPacket,
  base: TerminalPreviewMock,
): TerminalPreviewMock {
  const parsedPacket = parseTerminalAdapterPacket(packet);
  assertNoForbiddenVisibleCopy(parsedPacket);
  const copyProfile = copyProfileForFixtureFamily(
    fixtureFamilyFromPacket(parsedPacket),
  );

  const previewSources = parsedPacket.source_ledger.filter(
    isPreviewDisplayableSource,
  );
  const previewModules = parsedPacket.modules.filter(isPreviewDisplayableModule);
  const terminalState = terminalStateFromModules(
    previewModules,
    parsedPacket,
    base,
    copyProfile,
  );
  const indicators = indicatorsFromModules(previewModules, base, copyProfile);
  const developments = developmentsFromModules(
    previewModules,
    base,
    copyProfile,
  );
  const watchItems = watchItemsFromModules(previewModules, base, copyProfile);
  const scenarios = scenariosFromDisplayableContext(
    previewModules,
    base,
    copyProfile,
  );
  const featuredBrief = featuredBriefFromModules(
    previewModules,
    base,
    copyProfile,
  );

  return {
    ...base,
    routePolicy: {
      hidden: true,
      navLink: false,
      noindex: true,
    },
    terminalState,
    indicators,
    developments,
    watchItems,
    scenarios,
    featuredBrief,
    sourceLedger: previewSources.map(toPreviewSourceLedgerItem),
    modules: previewModules.map((module) =>
      toPreviewModule(module, parsedPacket),
    ),
    visibleCopy: {
      terminalState: {
        label: terminalState.label.en,
        summary: terminalState.summary.en,
      },
      indicators: indicators.map((item) => [
        item.label,
        item.value,
        item.note.en,
        item.note.ja,
      ]),
      developments: developments.map((item) => [
        item.label.en,
        item.label.ja,
        item.summary.en,
        item.summary.ja,
        item.sourceNote.en,
        item.sourceNote.ja,
      ]),
      watchItems: watchItems.map((item) => [
        item.title.en,
        item.title.ja,
        item.body.en,
        item.body.ja,
      ]),
      scenarios: scenarios.map((item) => [
        item.title.en,
        item.title.ja,
        item.body.en,
        item.body.ja,
        item.invalidation.en,
        item.invalidation.ja,
      ]),
      featuredBrief: [
        featuredBrief.title.en,
        featuredBrief.title.ja,
        featuredBrief.summary.en,
        featuredBrief.summary.ja,
      ],
      sourceLedger: previewSources.map((source) => [
        source.source_name,
        source.limitations_en,
        source.limitations_ja,
      ]),
    },
  };
}

export const terminalPreviewAdapterFixturePacket: TerminalAdapterPacket =
  parseTerminalAdapterPacket(readerTerminalPublicAdapterFixture);

export const terminalPreviewAdapterFixtureMock: TerminalPreviewMock =
  buildTerminalPreviewMockFromAdapterFixture(
    terminalPreviewAdapterFixturePacket,
    terminalPreviewMock,
  );
