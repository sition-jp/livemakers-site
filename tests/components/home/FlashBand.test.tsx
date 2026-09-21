/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { FlashBand } from "@/components/home/FlashBand";
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

const flash: ArticleMeta = {
  articleId: "flash-20260921-abc123",
  family: "flash",
  titleJa: "SEC が暗号資産の市場規則をホワイトハウス審査へ",
  titleEn: "SEC sends crypto market rules to White House review",
  publishedAtJst: "2026-09-21T16:40:00+09:00",
  href: "/articles/flash-20260921-abc123",
} as ArticleMeta;

describe("FlashBand (2026-09-21 田平氏 GO 案 1: トップの速報帯)", () => {
  it("renders the newest flash with the article link, time and the series link", () => {
    const { container } = render(<FlashBand article={flash} locale="ja" />);
    const band = container.querySelector('[data-home-section="flash"]');
    expect(band).not.toBeNull();
    expect(screen.getByText("速報")).toBeVisible();
    expect(screen.getByText(/16:40/)).toBeVisible();
    expect(screen.getByRole("link", { name: flash.titleJa })).toHaveAttribute(
      "href",
      "/articles/flash-20260921-abc123",
    );
    expect(screen.getByRole("link", { name: "速報一覧" })).toHaveAttribute(
      "href",
      "/articles/series/flash",
    );
  });

  it("uses the English title and labels for the en locale", () => {
    render(<FlashBand article={flash} locale="en" />);
    expect(screen.getByText("FLASH")).toBeVisible();
    expect(screen.getByRole("link", { name: flash.titleEn! })).toBeInTheDocument();
  });

  it("renders nothing when there is no fresh flash", () => {
    const { container } = render(<FlashBand article={null} locale="ja" />);
    expect(container.querySelector('[data-home-section="flash"]')).toBeNull();
    expect(container.textContent).toBe("");
  });
});
