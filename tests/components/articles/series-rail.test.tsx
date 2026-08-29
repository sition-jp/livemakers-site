/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SeriesRail, buildTestSeriesRailCopy } from "@/components/articles/SeriesRail";
import type { ArticleMeta } from "@/lib/articles/article-model";

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

const article = (
  articleId: string,
  family: ArticleMeta["family"],
  publishedAtJst: string,
): ArticleMeta => ({
  articleId,
  family,
  titleJa: `記事 ${articleId}`,
  publishedAtJst,
  publishedLabel: publishedAtJst.slice(5, 16),
  lanes: [],
  href: `/articles/${articleId}`,
});

const catalog: ArticleMeta[] = [
  article("sig-1", "signal", "2026-07-09T08:00:00+09:00"),
  article("sig-2", "signal", "2026-07-08T08:00:00+09:00"),
  article("intel-1", "daily-intel", "2026-07-09T07:00:00+09:00"),
  ...Array.from({ length: 6 }, (_, index) =>
    article(`dd-${index + 1}`, "deep-dive", `2026-07-0${6 - Math.min(index, 5)}T0${index + 1}:00:00+09:00`),
  ),
  article("mkt-am", "mkt12-morning", "2026-07-09T06:00:00+09:00"),
  article("err-1", "event-risk-radar", "2026-07-07T08:00:00+09:00"),
  article("map-1", "future-map", "2026-07-05T08:00:00+09:00"),
  article("mkt-we", "mkt12-weekend", "2026-07-04T08:00:00+09:00"),
];

const current = catalog[0];
const copy = buildTestSeriesRailCopy();

const sectionsOf = (container: HTMLElement): string[] =>
  [...container.querySelectorAll("[data-rail-section]")].map(
    (element) => element.getAttribute("data-rail-section")!,
  );

describe("SeriesRail (G44 D9)", () => {
  it("renders nine sections with the current series hoisted to the front", () => {
    const { container } = render(
      <SeriesRail articles={catalog} current={current} surfacePublished={false} copy={copy} />,
    );
    expect(sectionsOf(container)).toEqual([
      "signal",
      "session-terminal",
      "daily-intel",
      "latest-articles",
      "mkt12-morning",
      "event-risk-radar",
      "future-atlas",
      "mkt12-weekend",
      "weekly-brief",
    ]);
    const signalSection = container.querySelector('[data-rail-section="signal"]')!;
    expect(signalSection.textContent).toContain(copy.currentSeriesTitle);
    expect(
      signalSection.querySelector('[data-article-id="sig-1"]'),
    ).toBeNull();
    expect(
      signalSection.querySelector('[data-article-id="sig-2"]'),
    ).not.toBeNull();
  });

  it("keeps the ledger order when the current family has no rail section", () => {
    const sessionCurrent = article("sess-1", "session", "2026-07-09T05:03:00+09:00");
    const { container } = render(
      <SeriesRail
        articles={catalog}
        current={sessionCurrent}
        surfacePublished={false}
        copy={copy}
      />,
    );
    expect(sectionsOf(container)[0]).toBe("session-terminal");
    expect(sectionsOf(container)).toHaveLength(9);
  });

  it("shows every latest article except the current one and one article for other series", () => {
    const { container } = render(
      <SeriesRail articles={catalog} current={current} surfacePublished={false} copy={copy} />,
    );
    const latest = container.querySelector('[data-rail-section="latest-articles"]')!;
    // catalog 全件 - 現在記事 1 本 (20 本上限内)
    expect(latest.querySelectorAll("[data-article-id]")).toHaveLength(catalog.length - 1);
    expect(latest.querySelector('[data-article-id="sig-1"]')).toBeNull();
    expect(latest.textContent).toContain(copy.latestArticlesHeading);
    expect(
      container.querySelectorAll('[data-rail-section="daily-intel"] [data-article-id]'),
    ).toHaveLength(1);
  });

  it("caps the latest articles section at 20 rows", () => {
    const bigCatalog = [
      ...catalog,
      ...Array.from({ length: 25 }, (_, index) =>
        article(`sig-extra-${index + 1}`, "signal", "2026-07-03T08:00:00+09:00"),
      ),
    ];
    const { container } = render(
      <SeriesRail articles={bigCatalog} current={current} surfacePublished={false} copy={copy} />,
    );
    expect(
      container.querySelectorAll('[data-rail-section="latest-articles"] [data-article-id]'),
    ).toHaveLength(20);
  });

  it("hoists deep dive as the current series with five rows while keeping the nine standing sections", () => {
    const ddCurrent = catalog.find((entry) => entry.articleId === "dd-1")!;
    const { container } = render(
      <SeriesRail articles={catalog} current={ddCurrent} surfacePublished={false} copy={copy} />,
    );
    const sections = sectionsOf(container);
    expect(sections[0]).toBe("deep-dive");
    expect(sections).toHaveLength(10);
    const ddSection = container.querySelector('[data-rail-section="deep-dive"]')!;
    expect(ddSection.textContent).toContain(copy.currentSeriesTitle);
    expect(ddSection.querySelectorAll("[data-article-id]")).toHaveLength(5);
    expect(ddSection.querySelector('[data-article-id="dd-1"]')).toBeNull();
  });

  it("renders session terminal as an entry link without articles", () => {
    const { container } = render(
      <SeriesRail articles={catalog} current={current} surfacePublished={false} copy={copy} />,
    );
    const section = container.querySelector('[data-rail-section="session-terminal"]')!;
    expect(section.querySelector('a[href="/sessions/archive"]')).not.toBeNull();
    expect(section.querySelectorAll("[data-article-id]")).toHaveLength(0);
  });

  it("switches the atlas entry with the surfacePublished flag (G46 §11.3)", () => {
    const off = render(
      <SeriesRail articles={catalog} current={current} surfacePublished={false} copy={copy} />,
    );
    const offSection = off.container.querySelector('[data-rail-section="future-atlas"]')!;
    expect(
      offSection.querySelector('a[href="/articles/series/future-map"]'),
    ).not.toBeNull();
    expect(offSection.textContent).toContain(copy.atlasUnpublishedHeading);

    const on = render(
      <SeriesRail articles={catalog} current={current} surfacePublished copy={copy} />,
    );
    const onSection = on.container.querySelector('[data-rail-section="future-atlas"]')!;
    expect(onSection.querySelector('a[href="/future-atlas"]')).not.toBeNull();
    expect(onSection.textContent).toContain(copy.atlasPublishedHeading);
  });

  it("keeps weekly brief as a /brief entry even with no weekly-brief articles", () => {
    const { container } = render(
      <SeriesRail articles={catalog} current={current} surfacePublished={false} copy={copy} />,
    );
    const section = container.querySelector('[data-rail-section="weekly-brief"]')!;
    expect(section.querySelector('a[href="/brief"]')).not.toBeNull();
    expect(section.querySelectorAll("[data-article-id]")).toHaveLength(0);
  });

  it("marks every rail link as index navigation", () => {
    const { container } = render(
      <SeriesRail articles={catalog} current={current} surfacePublished={false} copy={copy} />,
    );
    for (const anchor of container.querySelectorAll("a[href]")) {
      expect(
        anchor.closest("[data-index-nav]"),
        `rail link lacks index-nav: ${anchor.getAttribute("href")}`,
      ).not.toBeNull();
    }
  });
});
