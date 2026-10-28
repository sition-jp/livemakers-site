/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  topicIndex: null as { articles: unknown[] } | null,
  fetchTopic: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: vi.fn(),
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

vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: vi.fn(async () => ({
    articles: [
      {
        articleId: "signal-1",
        family: "signal",
        titleJa: "Signal 1",
        publishedAtJst: "2026-10-02T20:00:00+09:00",
        publishedLabel: "10-02 20:00 公開",
        lanes: [],
        href: "/articles/signal-1",
      },
      {
        articleId: "dd-1",
        family: "deep-dive",
        titleJa: "DD 1",
        publishedAtJst: "2026-10-02T19:00:00+09:00",
        publishedLabel: "10-02 19:00 公開",
        lanes: [],
        href: "/articles/dd-1",
      },
    ],
    feedChecksum: null,
  })),
}));

vi.mock("@/lib/articles/article-inflow-v2", () => ({
  fetchArticleTopicIndex: mocks.fetchTopic,
}));

vi.mock("@/lib/articles/latest-articles-rail", () => ({
  loadLatestArticlesRail: vi.fn(async () => ({ articles: [], copy: { title: "rail" } })),
}));
vi.mock("@/lib/future-atlas/surface", () => ({
  loadEffectiveSurfacePublished: vi.fn(async () => false),
}));
vi.mock("@/lib/future-atlas/load", () => ({
  loadFutureAtlas: vi.fn(async () => ({ config: { surfacePublished: false } })),
}));

import ArticleSeriesPage from "@/app/[locale]/articles/series/[series]/page";

beforeEach(() => {
  mocks.topicIndex = null;
  mocks.fetchTopic.mockReset();
  mocks.fetchTopic.mockImplementation(async () => mocks.topicIndex);
});

const renderSeries = async (series: string) =>
  render(await ArticleSeriesPage({ params: Promise.resolve({ locale: "ja", series }) }));

describe("series list: funding shelf link", () => {
  it("signal series: shows topic link when index has items", async () => {
    mocks.topicIndex = { articles: [{ articleId: "signal-1" }] };
    await renderSeries("signal");
    const link = screen.getByText("funding.signalLink");
    expect(link).toHaveAttribute("href", "/topics/funding");
  });

  it("signal series: no link when index unavailable", async () => {
    mocks.topicIndex = null;
    await renderSeries("signal");
    expect(screen.queryByText("funding.signalLink")).toBeNull();
  });

  it("signal series: no link when index is empty", async () => {
    mocks.topicIndex = { articles: [] };
    await renderSeries("signal");
    expect(screen.queryByText("funding.signalLink")).toBeNull();
  });

  it("deep-dive series: never fetches topic index", async () => {
    mocks.topicIndex = { articles: [{ articleId: "signal-1" }] };
    await renderSeries("deep-dive");
    expect(mocks.fetchTopic).not.toHaveBeenCalled();
    expect(screen.queryByText("funding.signalLink")).toBeNull();
  });
});
