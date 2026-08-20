/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "@/components/layout/Header";
import ja from "@/messages/ja.json";

const usePathnameMock = vi.fn<() => string>(() => "/");

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
  usePathname: () => usePathnameMock(),
}));

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header futureAtlasNav={false} />
    </NextIntlClientProvider>,
  );
}

/**
 * ヘッダ言語トグル (2026-08-21 田平氏 GO)。
 * localePrefix "always" + localeDetection false なので、トグルは
 * cookie 細工なしの明示 URL リンク 2 本でよい。
 */
describe("Header language toggle", () => {
  it("links to the same page in each locale", () => {
    usePathnameMock.mockReturnValue("/articles");
    renderHeader();
    expect(screen.getByRole("link", { name: "日本語" })).toHaveAttribute(
      "href",
      "/ja/articles",
    );
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute(
      "href",
      "/en/articles",
    );
  });

  it("links to the locale roots from the home page", () => {
    usePathnameMock.mockReturnValue("/");
    renderHeader();
    expect(screen.getByRole("link", { name: "日本語" })).toHaveAttribute(
      "href",
      "/ja",
    );
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute(
      "href",
      "/en",
    );
  });
});
