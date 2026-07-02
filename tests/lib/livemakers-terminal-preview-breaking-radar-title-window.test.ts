import { describe, expect, it } from "vitest";
import {
  readerTerminalPublicTopology,
  validateReaderTerminalPublicTopology,
} from "@/lib/livemakers-terminal-preview/public-topology";
import { validateBreakingRadarTitleWindow } from "@/lib/livemakers-terminal-preview/breaking-radar-title-window";
import type { TerminalPreviewPublicTopology } from "@/lib/livemakers-terminal-preview/types";

describe("Breaking Radar title-window contract", () => {
  it("keeps X News / Trends and SDE Phase1 Breaking Radar as separate title-only lanes", () => {
    const liveRadar = readerTerminalPublicTopology.liveRadar;

    expect(validateBreakingRadarTitleWindow(liveRadar)).toEqual([]);
    expect(liveRadar.items.map((item) => item.sourceLane)).toEqual([
      "x_news_trends",
      "sde_phase1_breaking_radar",
      "manual_operator_observation",
    ]);
    expect(liveRadar.items.map((item) => item.sourceLabel.en)).toEqual([
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
