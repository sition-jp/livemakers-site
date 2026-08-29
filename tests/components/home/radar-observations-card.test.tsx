/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RadarObservationsCard } from "@/components/home/RadarObservationsCard";
import { buildTestHomeCopy } from "@/lib/home/home-copy";
import type { RadarObservation } from "@/lib/home/radar-observations";

const homeCopy = buildTestHomeCopy();
const copy = homeCopy.radar.observations;

const titleOnly: RadarObservation = {
  topicId: "quiet_topic_20260814",
  lane: "sde_phase1_breaking_radar",
  titleJa: "ステーブルコイン供給の週次増分が再加速",
  observedAtLabel: "05:12",
  href: null,
  displayMode: "title_only",
  publishDecision: "not_authorized",
};

const linked: RadarObservation = {
  topicId: "linked_topic_20260814",
  lane: "x_news_trends",
  titleJa: "米SECが暗号資産の開示規則案を公表",
  observedAtLabel: "08:02",
  href: "https://x.com/example/status/1234509876",
  displayMode: "title_with_source",
  publishDecision: "not_authorized",
};

describe("RadarObservationsCard (2026-08-14 一次ソースリンク裁定)", () => {
  it("renders href-null observations as plain text (no anchors)", () => {
    const { container } = render(
      <RadarObservationsCard observations={[titleOnly]} copy={copy} />,
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).toContain(titleOnly.titleJa);
  });

  it("renders linked observations as external primary-source links", () => {
    const { container } = render(
      <RadarObservationsCard observations={[titleOnly, linked]} copy={copy} />,
    );
    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(1);
    const anchor = anchors[0]!;
    expect(anchor.hasAttribute("data-source-link")).toBe(true);
    expect(anchor.getAttribute("href")).toBe(linked.href);
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(anchor.textContent).toContain(linked.titleJa);
    // 記事ルーティング属性は data-radar 内に存在しない (gate 1 と同じ境界)。
    expect(anchor.hasAttribute("data-article-id")).toBe(false);
    expect(anchor.hasAttribute("data-index-nav")).toBe(false);
  });
});
