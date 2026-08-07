/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HomeComposition } from "@/components/home/HomeComposition";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { buildTestHomeCopy } from "@/lib/home/home-copy";

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

const TEST_CONTENT_DIR = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "content",
  "articles",
);
const copy = buildTestHomeCopy();

/**
 * G43-d T4/plan: "production 相当" — neither test injection (args.radar /
 * args.promotions) nor a valid feed radar bundle is supplied, mirroring what
 * the real production route (load-home-composition.ts) does when the feed
 * has no radar bundle. The radar rail must degrade to an honest empty state,
 * never the retired code-embedded fixture.
 */
function productionEquivalentProps() {
  return buildHomeCompositionProps({
    today: "2026-07-10",
    articleCutoffToday: "2026-07-10",
    contentDir: TEST_CONTENT_DIR,
  });
}

describe("home radar rail — production-equivalent honest empty (G43-d)", () => {
  it("selects zero observations and a null radarPair", () => {
    const props = productionEquivalentProps();
    expect(props.radarSource).toBe("empty");
    expect(props.slots.observing).toEqual([]);
    expect(props.slots.radarPair).toBeNull();
  });

  it("renders FlashPromotionCard and EventRiskCard in their documented empty states", () => {
    const props = productionEquivalentProps();
    const { container } = render(
      <HomeComposition {...props} surfacePublished={false} copy={copy} />,
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-home-radar-source",
      "empty",
    );

    // FlashPromotionCard (radarPair === null): empty-state placeholder only —
    // no data-radar promoted card, no article-id link.
    expect(container.textContent).toContain(copy.radar.sectionTitle);
    expect(container.textContent).toContain(copy.radar.observations.note);

    // EventRiskCard's RadarObservationsCard renders unconditionally, but
    // with zero observation rows — exactly one [data-radar] section total
    // (the promoted card never renders when radarPair is null).
    const radarSections = [...container.querySelectorAll("[data-radar]")];
    expect(radarSections).toHaveLength(1);
    expect(radarSections[0].textContent).toContain(
      copy.radar.observations.title,
    );
    expect(radarSections[0].querySelectorAll("time")).toHaveLength(0);
    expect(radarSections[0].querySelectorAll("a")).toHaveLength(0);
  });
});
