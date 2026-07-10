import { z } from "zod";

import { matchesTerm } from "./reader-grammar";
import {
  forbiddenSourceOpsTerms,
  forbiddenSourceVisibleText,
} from "@/lib/terminal/live-market-feed";

export const RadarObservationSchema = z.strictObject({
  topicId: z.string().min(1),
  lane: z.enum([
    "x_news_trends",
    "sde_phase1_breaking_radar",
    "manual_operator_observation",
  ]),
  titleJa: z.string().min(1),
  observedAtLabel: z.string().regex(/^\d{2}:\d{2}$/),
  href: z.null(),
  displayMode: z.literal("title_only"),
  publishDecision: z.literal("not_authorized"),
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
