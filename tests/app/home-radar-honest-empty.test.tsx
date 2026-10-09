/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HomeComposition } from "@/components/home/HomeComposition";
import {
  buildHomeCompositionProps,
  resolveHomeRadarSource,
} from "@/lib/home/build-home-props";
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
  it("selects zero observations", () => {
    const props = productionEquivalentProps();
    // radarSource is resolved outside the builder (fix round 1, mirrors
    // catalogSource) — production-equivalent args (no source, no injection)
    // resolve to the honest-empty label via resolveHomeRadarSource.
    expect(resolveHomeRadarSource({})).toBe("empty");
    expect(props.slots.observing).toEqual([]);
  });

  it("renders the flash list (not the radar card) in its documented empty state", () => {
    const props = productionEquivalentProps();
    const radarSource = resolveHomeRadarSource({});
    const { container } = render(
      <HomeComposition
        {...props}
        radarSource={radarSource}
        surfacePublished={false}
        copy={copy}
      />,
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-home-radar-source",
      "empty",
    );

    // 2026-08-23: flash-promotion は撤去済み。2026-10-09 (案 A): 観測カードも
    // 撤去し、同じ位置に速報記事リスト (flash-list) を置く。
    expect(container.textContent).not.toContain("観測から記事へ");
    expect(container.querySelectorAll("[data-radar]")).toHaveLength(0);

    // fixture catalog に当日/前日の速報は無い — 空表示 + 速報一覧リンクのみ。
    const flashLists = [...container.querySelectorAll("[data-flash-list]")];
    expect(flashLists).toHaveLength(1);
    expect(flashLists[0].textContent).toContain(copy.flashList.title);
    expect(flashLists[0].textContent).toContain(copy.flashList.empty);
    expect(flashLists[0].querySelectorAll("[data-article-id]")).toHaveLength(0);
    const anchors = [...flashLists[0].querySelectorAll("a")];
    expect(anchors.map((anchor) => anchor.getAttribute("href"))).toEqual([
      "/articles/series/flash",
    ]);
  });
});
