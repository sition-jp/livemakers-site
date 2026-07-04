import { scheduledSessionVisibilityAdapterFixture } from "@/lib/livemakers-terminal-adapter/scheduled-session-visibility-fixture";
import type {
  TerminalAdapterModule,
  TerminalAdapterPacket,
} from "@/lib/livemakers-terminal-adapter/types";
import type {
  LocalizedText,
  TerminalScheduledSessionVisibility,
  TerminalScheduledSessionVisibilityItem,
  TerminalScheduledSessionVisibilityStatus,
} from "./types";

interface ScheduledSessionVisibilityMapEntry {
  moduleId: string;
  status: TerminalScheduledSessionVisibilityStatus;
  sourceItemId: string;
  reasonCode: string;
  titleFallback: LocalizedText;
  summaryFallback: LocalizedText;
}

const visibilityMap: ScheduledSessionVisibilityMapEntry[] = [
  {
    moduleId: "scheduled.market_state_header",
    status: "classified",
    sourceItemId: "vis_004_cross_asset_risk_classified",
    reasonCode: "source_backed_account_relevant",
    titleFallback: {
      en: "Asia Open market state",
      ja: "Asia Open市場状態",
    },
    summaryFallback: {
      en: "Cross-asset pressure is treated as session context, not an article decision.",
      ja: "クロスアセットの圧力は記事判断ではなくセッション文脈として扱います。",
    },
  },
  {
    moduleId: "scheduled.what_happened.macro",
    status: "surface_ready",
    sourceItemId: "vis_001_fed_stress_test_surface_ready",
    reasonCode: "source_backed_account_relevant",
    titleFallback: {
      en: "Bank capital check",
      ja: "銀行資本チェック",
    },
    summaryFallback: {
      en: "The stress-test item is visible as macro and liquidity context, pending source refresh.",
      ja: "ストレステスト項目は、ソース再確認前のマクロ・流動性文脈として表示します。",
    },
  },
  {
    moduleId: "scheduled.leading_indicators",
    status: "verify_next",
    sourceItemId: "vis_002_cardano_hf_verify_next",
    reasonCode: "primary_source_required",
    titleFallback: {
      en: "Cardano status wording needs direct confirmation.",
      ja: "Cardanoの状態表現は直接確認が必要です。",
    },
    summaryFallback: {
      en: "The item remains visible as a next-check, not as final public wording.",
      ja: "この項目は最終公開文言ではなく、次の確認点として表示します。",
    },
  },
  {
    moduleId: "scheduled.what_happened.ai_cost",
    status: "signal_seed",
    sourceItemId: "vis_003_ai_inference_cost_signal_seed",
    reasonCode: "deferred_to_signal_or_deep_dive",
    titleFallback: {
      en: "AI inference cost watch",
      ja: "AI推論コスト観測",
    },
    summaryFallback: {
      en: "Inference-cost competition is held as future coverage seed material.",
      ja: "推論コスト競争は今後の深掘り候補として保持します。",
    },
  },
  {
    moduleId: "scheduled.already_covered.blocked",
    status: "already_covered",
    sourceItemId: "vis_006_duplicate_fed_row_already_covered",
    reasonCode: "already_covered_same_angle",
    titleFallback: {
      en: "Duplicate Fed review row already covered",
      ja: "Fed重複レビュー行は既に扱い済み",
    },
    summaryFallback: {
      en: "Duplicate context is accounted for without repeating it as a fresh article item.",
      ja: "重複文脈は、新しい記事項目として繰り返さずに記録します。",
    },
  },
];

function payloadText(
  payload: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function firstPayloadArrayText(
  payload: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return fallback;
  }

  const first = value.find(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  return first ?? fallback;
}

function titleFromModule(
  module: TerminalAdapterModule,
  entry: ScheduledSessionVisibilityMapEntry,
): LocalizedText {
  if (module.module_id === "scheduled.leading_indicators") {
    return {
      en: firstPayloadArrayText(
        module.payload,
        "items",
        entry.titleFallback.en,
      ),
      ja: firstPayloadArrayText(
        module.payload,
        "items_ja",
        entry.titleFallback.ja,
      ),
    };
  }

  return {
    en: payloadText(module.payload, "label_en", entry.titleFallback.en),
    ja: payloadText(module.payload, "label_ja", entry.titleFallback.ja),
  };
}

function summaryFromModule(
  module: TerminalAdapterModule,
  entry: ScheduledSessionVisibilityMapEntry,
): LocalizedText {
  return {
    en: payloadText(module.payload, "summary_en", entry.summaryFallback.en),
    ja: payloadText(module.payload, "summary_ja", entry.summaryFallback.ja),
  };
}

function moduleById(
  packet: TerminalAdapterPacket,
  moduleId: string,
): TerminalAdapterModule {
  const module = packet.modules.find((candidate) => candidate.module_id === moduleId);
  if (!module) {
    throw new Error(`Scheduled session visibility module missing: ${moduleId}`);
  }

  return module;
}

function readerFacingFamily(module: TerminalAdapterModule): string {
  if (module.data_family === "internal_sde_state") {
    return "editorial";
  }

  return module.data_family;
}

function itemFromModule(
  packet: TerminalAdapterPacket,
  entry: ScheduledSessionVisibilityMapEntry,
): TerminalScheduledSessionVisibilityItem {
  const module = moduleById(packet, entry.moduleId);

  return {
    id: entry.sourceItemId,
    status: entry.status,
    family: readerFacingFamily(module),
    title: titleFromModule(module, entry),
    summary: summaryFromModule(module, entry),
    sourceItemId: entry.sourceItemId,
    reasonCode: entry.reasonCode,
    detectedAtJst: packet.as_of_jst ?? packet.generated_at,
    href: null,
    publishDecision: "not_authorized",
  };
}

export function getScheduledSessionVisibility(
  packet: TerminalAdapterPacket = scheduledSessionVisibilityAdapterFixture,
): TerminalScheduledSessionVisibility {
  return {
    title: {
      en: "SDE session visibility",
      ja: "SDEセッション可視化",
    },
    sessionLabel: {
      en: "Asia Open Terminal",
      ja: "Asia Open Terminal",
    },
    sessionSlug: "asia_open",
    internalSlot: "morning",
    asOfJst: packet.as_of_jst ?? packet.generated_at,
    sourcePacketId: packet.packet_id,
    items: visibilityMap.map((entry) => itemFromModule(packet, entry)),
  };
}
