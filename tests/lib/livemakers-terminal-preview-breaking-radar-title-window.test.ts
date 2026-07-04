import { describe, expect, it } from "vitest";
import {
  readerTerminalPublicTopology,
  validateReaderTerminalPublicTopology,
} from "@/lib/livemakers-terminal-preview/public-topology";
import { validateBreakingRadarTitleWindow } from "@/lib/livemakers-terminal-preview/breaking-radar-title-window";
import type { TerminalPreviewPublicTopology } from "@/lib/livemakers-terminal-preview/types";

const manualLinkNoteCandidateTitles = [
  "Crypto card deposits cross $10B for the first time",
  "Fed rate-hike projection resurfaces for this year",
  "BEVキャンピングカー、東京ショー前に注目",
  "EU電池パスポート要件、Cardano活用事例として観測",
  "Cardano、OpenUSDローンチパートナー文脈を観測",
  "原油、125日ぶり67.5ドル割れとの観測",
  "米M2、5月に過去最高との観測",
  "米ドルロング取引の混雑、流動性シグナルとして観測",
  "10年債入札弱めで金利上昇、財政・インフレ懸念も",
  "伊藤忠、物流・工場向けフィジカルAI導入支援へ",
  "キオクシア急落、米半導体株安から連想売り",
  "米移民拘束増、政権方針転換リスクとして観測",
  "歴史的円安、国際協調と戦略対応の論点に",
  "円安進行に財務相が「断固たる措置」言及",
  "米最高裁、出生地主義を維持との観測",
];

describe("Breaking Radar title-window contract", () => {
  it("keeps X News / Trends and SDE Phase1 Breaking Radar as separate title-only lanes", () => {
    const liveRadar = readerTerminalPublicTopology.liveRadar;

    expect(validateBreakingRadarTitleWindow(liveRadar)).toEqual([]);
    expect(liveRadar.items.slice(0, 3).map((item) => item.sourceLane)).toEqual([
      "x_news_trends",
      "sde_phase1_breaking_radar",
      "manual_operator_observation",
    ]);
    expect(liveRadar.items.slice(0, 3).map((item) => item.sourceLabel.en)).toEqual([
      "X News / Trends",
      "SDE Phase1 Breaking Radar",
      "Manual observation",
    ]);
    expect(liveRadar.items.every((item) => item.href === null)).toBe(true);
    expect(liveRadar.items.every((item) => item.body === undefined)).toBe(true);
    expect(liveRadar.items.every((item) => item.displayMode === "title_only")).toBe(
      true,
    );
    expect(
      liveRadar.items.every((item) => item.publishDecision === "not_authorized"),
    ).toBe(true);
  });

  it("maps G38-C manual link-note candidates as title-only unpublished radar fixtures", () => {
    const manualItems = readerTerminalPublicTopology.liveRadar.items.filter((item) =>
      item.id.startsWith("br-manual-20260702-"),
    );

    expect(manualItems.map((item) => item.title.ja)).toEqual(
      manualLinkNoteCandidateTitles,
    );
    expect(manualItems).toHaveLength(15);
    expect(manualItems.every((item) => item.sourceLane === "manual_operator_observation")).toBe(
      true,
    );
    expect(manualItems.every((item) => item.sourceLabel.en === "Manual link-note")).toBe(
      true,
    );
    expect(manualItems.every((item) => item.href === null)).toBe(true);
    expect(manualItems.every((item) => item.displayMode === "title_only")).toBe(true);
    expect(
      manualItems.every((item) => item.publishDecision === "not_authorized"),
    ).toBe(true);

    const serializedManualItems = JSON.stringify(manualItems);
    expect(serializedManualItems).not.toContain("https://x.com");
    expect(serializedManualItems).not.toContain("body");
    expect(serializedManualItems).not.toContain("excerpt");
    expect(serializedManualItems).not.toContain("articleText");
    expect(serializedManualItems).not.toContain("screenshotText");
    expect(serializedManualItems).not.toContain("rawPersonalizedText");
    expect(serializedManualItems).not.toContain("rawRecommendationText");
  });

  it("rejects linked, body-bearing, internal, or lane-collapsed radar windows", () => {
    const base = readerTerminalPublicTopology.liveRadar;
    const linked = {
      ...base,
      items: [
        {
          ...base.items[0],
          href: "/brief/2026-W26-brief",
        },
        base.items[1],
      ],
    } as TerminalPreviewPublicTopology["liveRadar"];
    const forbiddenPayloadKeys = [
      "body",
      "excerpt",
      "articleText",
      "screenshotText",
      "rawPersonalizedText",
      "rawRecommendationText",
    ];
    const missingX = {
      ...base,
      items: base.items.filter((item) => item.sourceLane !== "x_news_trends"),
    };
    const missingSde = {
      ...base,
      items: base.items.filter(
        (item) => item.sourceLane !== "sde_phase1_breaking_radar",
      ),
    };
    const internalText = {
      ...base,
      items: [
        {
          ...base.items[0],
          title: {
            ...base.items[0].title,
            en: "site_publish_log leak",
          },
        },
        base.items[1],
      ],
    };

    expect(validateBreakingRadarTitleWindow(linked)).toContain(
      "liveRadar.items[0].href must remain null for title-window display",
    );
    for (const key of forbiddenPayloadKeys) {
      const payloadBearing = {
        ...base,
        items: [
          {
            ...base.items[0],
            [key]: "raw X recommendation body",
          },
          base.items[1],
        ],
      } as TerminalPreviewPublicTopology["liveRadar"];

      expect(validateBreakingRadarTitleWindow(payloadBearing)).toContain(
        `liveRadar.items[0].${key} must be absent for title-window display`,
      );
    }
    expect(validateBreakingRadarTitleWindow(missingX)).toContain(
      "liveRadar.items must include x_news_trends lane",
    );
    expect(validateBreakingRadarTitleWindow(missingSde)).toContain(
      "liveRadar.items must include sde_phase1_breaking_radar lane",
    );
    expect(validateBreakingRadarTitleWindow(internalText)).toContain(
      "liveRadar.items[0].title.en contains forbidden internal text: site_publish_log",
    );
  });

  it("feeds title-window validation into the public topology validator", () => {
    const unsafe = {
      ...readerTerminalPublicTopology,
      liveRadar: {
        ...readerTerminalPublicTopology.liveRadar,
        items: [
          {
            ...readerTerminalPublicTopology.liveRadar.items[0],
            href: "/brief/2026-W26-brief",
          },
          readerTerminalPublicTopology.liveRadar.items[1],
        ],
      } as TerminalPreviewPublicTopology["liveRadar"],
    };

    expect(validateReaderTerminalPublicTopology(unsafe)).toContain(
      "liveRadar.items[0].href must remain null for title-window display",
    );
  });
});
