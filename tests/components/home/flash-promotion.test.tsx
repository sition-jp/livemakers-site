/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { FlashPromotionCard } from "@/components/home/FlashPromotionCard";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { buildTestHomeCopy } from "@/lib/home/home-copy";
import type { RadarObservation } from "@/lib/home/radar-observations";
import type { HomeSlots } from "@/lib/home/select-home-slots";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const homeCopy = buildTestHomeCopy();
const copy = {
  sectionTitle: homeCopy.radar.sectionTitle,
  promoted: homeCopy.radar.promoted,
  emptyNote: homeCopy.radar.observations.note,
  familyLabels: homeCopy.familyLabels,
};

const observation: RadarObservation = {
  topicId: "stablecoin_supply_20260710",
  lane: "sde_phase1_breaking_radar",
  titleJa: "ステーブルコイン供給の週次増分が再加速",
  observedAtLabel: "05:12",
  href: null,
  displayMode: "title_only",
  publishDecision: "not_authorized",
};
const article: ArticleMeta = {
  articleId: "signal-stablecoin-supply-2026-07-10",
  family: "signal",
  titleJa: "ステーブルコイン供給、再加速の内実",
  publishedAtJst: "2026-07-10T06:10:00+09:00",
  publishedLabel: "07-10 06:10 公開",
  lanes: ["crypto"],
  href: "/articles/signal-stablecoin-supply-2026-07-10",
};
const pair: NonNullable<HomeSlots["radarPair"]> = { observation, article };

describe("FlashPromotionCard", () => {
  it("renders a title-only observation and exactly one promoted article link when a pair exists", () => {
    const { container } = render(<FlashPromotionCard pair={pair} copy={copy} />);
    // The observation module is title-only: no anchors inside data-radar (gate 1).
    expect(container.querySelectorAll("[data-radar] a")).toHaveLength(0);
    // The promoted article is a single link with data-article-id, OUTSIDE data-radar.
    const links = container.querySelectorAll("a[data-article-id]");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("data-article-id")).toBe(
      "signal-stablecoin-supply-2026-07-10",
    );
    expect(links[0]!.closest("[data-radar]")).toBeNull();
  });

  it("renders an empty state with no links when the pair is null", () => {
    const { container } = render(<FlashPromotionCard pair={null} copy={copy} />);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelector("[data-article-id]")).toBeNull();
    // The empty-state placeholder still renders (module slot is retained, not blank).
    expect(container.textContent?.trim()).not.toBe("");
  });
});
