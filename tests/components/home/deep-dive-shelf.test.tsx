/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DeepDiveShelf } from "@/components/home/DeepDiveShelf";
import type { ArticleMeta } from "@/lib/articles/article-model";
import { buildTestHomeCopy } from "@/lib/home/home-copy";

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

const mk = (id: string): ArticleMeta => ({
  articleId: id,
  family: "deep-dive",
  titleJa: id,
  publishedAtJst: "2026-07-09T21:30:00+09:00",
  publishedLabel: "07-09 21:30 公開",
  lanes: [],
  href: `/articles/${id}`,
});
const articles = ["dd0", "dd1", "dd2", "dd3", "dd4"].map(mk);
const homeCopy = buildTestHomeCopy();
const copy = {
  title: homeCopy.gradient.deepDiveTitle,
  familyLabels: homeCopy.familyLabels,
};

describe("DeepDiveShelf", () => {
  it("renders the featured deep dive as body and the other four as index-nav title rows", () => {
    const { container } = render(
      <DeepDiveShelf articles={articles} copy={copy} />,
    );
    // five article links total (featured + 4 title rows)
    expect(container.querySelectorAll("a[data-article-id]")).toHaveLength(5);
    // featured (first) is body content — not inside any data-index-nav
    const featured = container.querySelector('a[data-article-id="dd0"]')!;
    expect(featured.closest("[data-index-nav]")).toBeNull();
    // the remaining four are index-nav (dedup-exempt for gate 6)
    for (const id of ["dd1", "dd2", "dd3", "dd4"]) {
      const row = container.querySelector(`a[data-article-id="${id}"]`)!;
      expect(row.closest("[data-index-nav]")).not.toBeNull();
    }
  });

  it("caps the shelf at five even if more deep dives are supplied", () => {
    const { container } = render(
      <DeepDiveShelf articles={[...articles, mk("dd5")]} copy={copy} />,
    );
    expect(container.querySelectorAll("a[data-article-id]")).toHaveLength(5);
    expect(container.querySelector('a[data-article-id="dd5"]')).toBeNull();
  });
});
