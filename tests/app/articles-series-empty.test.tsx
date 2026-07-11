/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
});
