/* @vitest-environment jsdom */
import path from "node:path";

import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ArticleRow } from "@/components/home/ArticleRow";
import { getArticleBySlug } from "@/lib/articles/article-model";

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

describe("shared article cells", () => {
  it("renders family, title, and published label as one article link", () => {
    render(
      <ArticleRow
        article={getArticleBySlug("signal-dxy-plateau-2026-07-09", {
          contentDir: path.join(process.cwd(), "tests", "fixtures", "content", "articles"),
        })}
        familyLabel="Signal"
      />,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toContain(
      "/articles/signal-dxy-plateau-2026-07-09",
    );
    expect(link.getAttribute("data-article-id")).toBe(
      "signal-dxy-plateau-2026-07-09",
    );
    expect(screen.getByText("Signal")).toBeInTheDocument();
    expect(screen.getByText(/07-09 16:40 公開/)).toBeInTheDocument();
  });
});
