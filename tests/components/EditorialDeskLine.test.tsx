/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { EditorialDeskLine } from "@/components/articles/EditorialDeskLine";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";

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

describe("EditorialDeskLine", () => {
  it("signs the article with the desk and points at the about anchor", () => {
    render(<EditorialDeskLine label={jaMessages.articles.detail.editorialDesk} />);

    const link = screen.getByRole("link", { name: "LiveMakers 編集デスク" });
    // localePrefix: "always" なので実際の描画では /ja が前置される (Link が付与)
    expect(link).toHaveAttribute("href", "/about#editorial-desk");
    expect(document.querySelector("[data-article-desk]")).not.toBeNull();
    // 署名に個人名を出さない (2026-09-09 田平氏確定)
    expect(document.body.textContent).not.toContain("田平");
  });

  it("renders the English label from the same contract", () => {
    render(<EditorialDeskLine label={enMessages.articles.detail.editorialDesk} />);
    expect(
      screen.getByRole("link", { name: "LiveMakers Editorial Desk" }),
    ).toHaveAttribute("href", "/about#editorial-desk");
  });

  it("keeps the about copy it points at explaining the AI and human split", () => {
    for (const messages of [jaMessages, enMessages]) {
      expect(messages.about.deskTitle.length).toBeGreaterThan(0);
      expect(messages.about.deskBody).toContain("AI");
      expect(messages.about.deskBody).not.toContain("田平");
    }
    expect(jaMessages.about.deskBody).toContain("人が行います");
    expect(enMessages.about.deskBody).toContain("a person verifies");
  });
});
