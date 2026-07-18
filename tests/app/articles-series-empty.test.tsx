/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { atlasConfig } = vi.hoisted(() => ({
  atlasConfig: { surfacePublished: false },
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

vi.mock("@/lib/articles/article-model", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/articles/article-model")
  >();
  return { ...original, getAllArticles: () => [] };
});

vi.mock("@/lib/future-atlas/load", () => ({
  loadFutureAtlas: vi.fn(async () => ({ config: atlasConfig })),
}));

import ArticleSeriesPage from "@/app/[locale]/articles/series/[series]/page";

describe("series page with empty inventory", () => {
  it("renders the series shell without rows and keeps the brief archive link", async () => {
    const page = await ArticleSeriesPage({
      params: Promise.resolve({ locale: "ja", series: "weekly-brief" }),
    });
    render(page);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-article-id]")).toHaveLength(0);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/brief");
  });

  it("shows one Future Atlas guidance link only after the surface is published", async () => {
    atlasConfig.surfacePublished = true;
    const publishedPage = await ArticleSeriesPage({
      params: Promise.resolve({ locale: "ja", series: "future-map" }),
    });
    const { unmount } = render(publishedPage);
    expect(
      screen.getByRole("link", { name: "futureAtlasGuide" }).getAttribute("href"),
    ).toBe("/future-atlas");
    unmount();

    atlasConfig.surfacePublished = false;
    const hiddenPage = await ArticleSeriesPage({
      params: Promise.resolve({ locale: "ja", series: "future-map" }),
    });
    render(hiddenPage);
    expect(screen.queryByRole("link", { name: "futureAtlasGuide" })).toBeNull();
  });
});
