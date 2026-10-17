/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import section from "../fixtures/landmark/section.json";

const mocks = vi.hoisted(() => ({
  landmark: undefined as unknown,
  articles: [] as unknown[],
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
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

vi.mock("@/lib/articles/article-model", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/articles/article-model")>();
  return { ...original, getAllArticles: () => [] };
});

vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadPublicArticleInflowCatalog: vi.fn(async () => ({ articles: mocks.articles, feedChecksum: null })),
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

vi.mock("@/lib/terminal/live-market-feed", async () => {
  const { mapLandmarkMeter } = await import("@/lib/landmark/meter-feed");
  return {
    fetchLiveMarketData: vi.fn(async () =>
      mocks.landmark === undefined ? null : { landmark: mapLandmarkMeter(mocks.landmark) },
    ),
  };
});

import ArticleSeriesPage from "@/app/[locale]/articles/series/[series]/page";
import ArticleSeriesPagedPage from "@/app/[locale]/articles/series/[series]/page/[page]/page";

async function renderSeries(locale: string, series: string) {
  const page = await ArticleSeriesPage({ params: Promise.resolve({ locale, series }) });
  return render(page);
}

function landmarkArticle(index: number) {
  const day = 2 - Math.floor(index / 10);
  const ymd = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
  const hour = String(20 - (index % 10)).padStart(2, "0");
  return {
    articleId: `landmark-${String(index).padStart(3, "0")}`,
    family: "landmark",
    titleJa: `節目シグナル ${index}`,
    publishedAtJst: `${ymd}T${hour}:00:00+09:00`,
    publishedLabel: `${ymd.slice(5)} ${hour}:00 公開`,
    lanes: [],
    href: `/articles/landmark-${String(index).padStart(3, "0")}`,
  };
}

describe("landmark series page meter", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T10:45:00Z"));
    mocks.landmark = structuredClone(section);
    mocks.articles = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the meter once on the Japanese landmark page", async () => {
    const { container } = await renderSeries("ja", "landmark");
    expect(container.querySelectorAll("[data-landmark-meter]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-landmark-row]")).toHaveLength(6);
  });

  it("does not show the meter on the English page or other series", async () => {
    const en = await renderSeries("en", "landmark");
    expect(en.container.querySelector("[data-landmark-meter]")).toBeNull();
    en.unmount();
    const signal = await renderSeries("ja", "signal");
    expect(signal.container.querySelector("[data-landmark-meter]")).toBeNull();
  });

  it("does not show the meter when the feed has no landmark or only stale rows", async () => {
    mocks.landmark = undefined;
    const absent = await renderSeries("ja", "landmark");
    expect(absent.container.querySelector("[data-landmark-meter]")).toBeNull();
    absent.unmount();
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    mocks.landmark = structuredClone(section);
    const stale = await renderSeries("ja", "landmark");
    expect(stale.container.querySelector("[data-landmark-meter]")).toBeNull();
  });

  it("does not show the meter on page 2", async () => {
    mocks.articles = Array.from({ length: 31 }, (_, i) => landmarkArticle(i));
    const page2 = await ArticleSeriesPagedPage({
      params: Promise.resolve({ locale: "ja", series: "landmark", page: "2" }),
    });
    const { container } = render(page2);
    expect(container.querySelector("[data-landmark-meter]")).toBeNull();
  });
});
