/* @vitest-environment jsdom */
import path from "node:path";

import { render, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SeriesRail, buildTestSeriesRailCopy } from "@/components/articles/SeriesRail";
import { HomeComposition } from "@/components/home/HomeComposition";
import { VideoRailCard } from "@/components/videos/VideoRailCard";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { buildTestHomeCopy } from "@/lib/home/home-copy";
import { isAllowedVideoRoute } from "@/lib/livemakers-terminal-preview/public-topology";
import type { VideoCardData } from "@/lib/videos";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const VIDEO: VideoCardData = {
  slug: "ep001-finance-reboot",
  href: "/videos/ep001-finance-reboot",
  titleJa: "金融は再起動している",
  subtitleJa: "副題",
  durationSeconds: 2303,
  eyecatch: { src: "/thumbnails/video-ep001-finance-reboot.jpg", width: 1536, height: 1024, alt: "絵" },
};
const LATEST = { video: VIDEO, heading: "最新の動画", watchLabel: "動画を見る" };
const RELATED = { video: VIDEO, heading: "この記事の解説動画", watchLabel: "動画を見る" };

describe("VideoRailCard (2026-10-31 田平氏 GO)", () => {
  it("動画の記事へ飛ぶ索引扱いのカードで、YouTube は埋め込まない", () => {
    const { container } = render(<VideoRailCard {...LATEST} placement="latest" />);
    const card = container.querySelector("[data-video-rail]")!;
    expect(card).toHaveAttribute("data-video-rail", "latest");
    expect(card).toHaveAttribute("data-index-nav", "");
    const link = within(card as HTMLElement).getByRole("link");
    expect(link).toHaveAttribute("href", "/videos/ep001-finance-reboot");
    expect(isAllowedVideoRoute(link.getAttribute("href")!)).toBe(true);
    expect(container.querySelector("iframe")).toBeNull();
    expect(card.textContent).toContain("38分23秒");
  });
});

const article = (articleId: string, family: ArticleMeta["family"], at: string): ArticleMeta => ({
  articleId,
  family,
  titleJa: `記事 ${articleId}`,
  publishedAtJst: at,
  publishedLabel: at.slice(5, 16),
  lanes: [],
  href: `/articles/${articleId}`,
});
const catalog = [
  article("sig-1", "signal", "2026-07-09T08:00:00+09:00"),
  article("intel-1", "daily-intel", "2026-07-09T07:00:00+09:00"),
];
const railCopy = buildTestSeriesRailCopy();

describe("記事の右レーンの動画の窓", () => {
  it("関連記事なら先頭に「この記事の解説動画」を出し、末尾の「最新の動画」は重ねない", () => {
    const { container } = render(
      <SeriesRail
        articles={catalog}
        current={catalog[0]}
        surfacePublished={false}
        copy={railCopy}
        relatedVideo={RELATED}
        latestVideo={LATEST}
      />,
    );
    const cards = [...container.querySelectorAll("[data-video-rail]")];
    expect(cards.map((card) => card.getAttribute("data-video-rail"))).toEqual(["related"]);
    const aside = container.querySelector("[data-article-rail]")!;
    // 先頭: レーンの見出し (ほかのシリーズ) より前
    expect(aside.firstElementChild?.querySelector('[data-video-rail="related"]')).not.toBeNull();
  });

  it("関連記事でなければ末尾に「最新の動画」", () => {
    const { container } = render(
      <SeriesRail
        articles={catalog}
        current={catalog[0]}
        surfacePublished={false}
        copy={railCopy}
        latestVideo={LATEST}
      />,
    );
    const sections = container.querySelector("[data-article-rail] .space-y-4")!;
    expect(sections.lastElementChild).toHaveAttribute("data-video-rail", "latest");
  });

  it("YouTube に上がった回が無ければ窓を出さない", () => {
    const { container } = render(
      <SeriesRail articles={catalog} current={catalog[0]} surfacePublished={false} copy={railCopy} />,
    );
    expect(container.querySelector("[data-video-rail]")).toBeNull();
  });
});

describe("トップ右列の動画の窓", () => {
  const props = buildHomeCompositionProps({
    today: "2026-07-10",
    articleCutoffToday: "2026-07-10",
    contentDir: path.join(process.cwd(), "tests", "fixtures", "content", "articles"),
  });
  const copy = buildTestHomeCopy();
  const modulesOf = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-ledger-group="lagging"] > [data-column-module]')].map(
      (element) => element.getAttribute("data-column-module"),
    );

  it("記事の枠の直後・スマホの Event Risk の前に「最新の動画」を出す", () => {
    const { container } = render(
      <HomeComposition {...props} surfacePublished={false} copy={copy} videoCard={LATEST} />,
    );
    const host = container.querySelector('[data-column-module="video"]')!;
    expect(host.hasAttribute("hidden")).toBe(false);
    expect(within(host as HTMLElement).getByRole("link")).toHaveAttribute(
      "href",
      "/videos/ep001-finance-reboot",
    );
    const modules = modulesOf(container);
    expect(modules.indexOf("video")).toBe(modules.indexOf("event-risk-mobile") - 1);
  });

  it("YouTube に上がった回が無ければ枠ごと隠す", () => {
    const { container } = render(<HomeComposition {...props} surfacePublished={false} copy={copy} />);
    const host = container.querySelector('[data-column-module="video"]')!;
    expect(host).toHaveAttribute("hidden");
    expect(host.querySelector("a")).toBeNull();
  });
});
