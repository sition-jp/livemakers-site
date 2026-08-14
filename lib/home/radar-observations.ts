import { z } from "zod";

import { matchesTerm } from "./reader-grammar";
import {
  forbiddenSourceOpsTerms,
  forbiddenSourceVisibleText,
} from "@/lib/terminal/live-market-feed";

/**
 * 2026-08-14 田平氏裁定: 観測タイトルは LVM 記事ではなく一次ソース (X ポスト)
 * へ外部リンクしてよい (速報伝達フォーカス)。許可ホストは X のみ — それ以外の
 * URL は供給側 (radar_state / radar_builder) が href=null に落とす契約なので、
 * ここに届いた時点で不適合なら bundle ごと reject する (fail-closed 継続)。
 */
export const RADAR_SOURCE_URL_ALLOWLIST =
  /^https:\/\/(www\.)?(x\.com|twitter\.com)\/[^\s]*$/;

export const RadarObservationSchema = z
  .strictObject({
    topicId: z.string().min(1),
    lane: z.enum([
      "x_news_trends",
      "sde_phase1_breaking_radar",
      "manual_operator_observation",
    ]),
    titleJa: z.string().min(1),
    observedAtLabel: z.string().regex(/^\d{2}:\d{2}$/),
    href: z.union([z.null(), z.string().regex(RADAR_SOURCE_URL_ALLOWLIST)]),
    displayMode: z.enum(["title_only", "title_with_source"]),
    publishDecision: z.literal("not_authorized"),
  })
  .superRefine((observation, ctx) => {
    // displayMode は href の有無の鏡でなければならない — 片方だけ変わった
    // payload (供給側の部分実装や手書き) を通さない。
    const linked = observation.href !== null;
    if (linked !== (observation.displayMode === "title_with_source")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "displayMode must mirror href presence",
        path: ["displayMode"],
      });
    }
  });

export type RadarObservation = z.infer<typeof RadarObservationSchema>;
export type RadarLane = RadarObservation["lane"];

const RAW: RadarObservation[] = [
  {
    topicId: "stablecoin_supply_20260710",
    lane: "sde_phase1_breaking_radar",
    titleJa: "ステーブルコイン供給の週次増分が再加速",
    observedAtLabel: "05:12",
    href: null,
    displayMode: "title_only",
    publishDecision: "not_authorized",
  },
  {
    topicId: "tokenized_mmf_report_20260710",
    lane: "x_news_trends",
    titleJa: "米大手資産運用、トークン化MMF拡大の報道が浮上",
    observedAtLabel: "07:41",
    href: null,
    displayMode: "title_only",
    publishDecision: "not_authorized",
  },
  {
    topicId: "ai_chip_export_20260710",
    lane: "manual_operator_observation",
    titleJa: "AI半導体の対中輸出関連ニュース、一次ソース確認中",
    observedAtLabel: "06:55",
    href: null,
    displayMode: "title_only",
    publishDecision: "not_authorized",
  },
  {
    topicId: "eu_stablecoin_guidance_20260710",
    lane: "x_news_trends",
    titleJa: "欧州ステーブルコイン規制の追加ガイダンス観測",
    observedAtLabel: "06:31",
    href: null,
    displayMode: "title_only",
    publishDecision: "not_authorized",
  },
];

export function assertRadarObservationContract(
  observations: readonly RadarObservation[],
): void {
  const seen = new Set<string>();
  for (const observation of observations) {
    RadarObservationSchema.parse(observation);
    if (seen.has(observation.topicId)) {
      throw new Error(`duplicate radar topicId: ${observation.topicId}`);
    }
    seen.add(observation.topicId);

    const lower = observation.titleJa.toLowerCase();
    for (const term of [
      ...forbiddenSourceVisibleText,
      ...forbiddenSourceOpsTerms,
    ]) {
      if (matchesTerm(lower, term.toLowerCase())) {
        throw new Error(
          `radar title contains forbidden internal text: ${term}`,
        );
      }
    }
  }
}

export const RADAR_OBSERVATIONS: readonly RadarObservation[] = RAW.map(
  (observation) => RadarObservationSchema.parse(observation),
);
