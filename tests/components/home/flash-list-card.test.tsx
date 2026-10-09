/* @vitest-environment jsdom */
import path from "node:path";

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { FlashListCard } from "@/components/home/FlashListCard";
import { getAllArticles, type ArticleMeta } from "@/lib/articles/article-model";
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

const TEST_CONTENT_DIR = path.join(process.cwd(), "tests", "fixtures", "content", "articles");
const base = getAllArticles({ contentDir: TEST_CONTENT_DIR })[0]!;
const copy = buildTestHomeCopy().flashList;

const flash = (
  id: string,
  publishedAtJst: string,
  titleJa: string,
  titleEn?: string,
): ArticleMeta => ({
  ...base,
  articleId: id,
  family: "flash",
  publishedAtJst,
  titleJa,
  titleEn,
  href: `/articles/${id}`,
});

const today = flash(
  "flash-mica",
  "2026-10-09T09:40:00+09:00",
  "EU当局、MiCA非準拠ステーブルコインのサービス終了を要請",
  "EU authorities ask firms to wind down non-MiCA stablecoin services",
);
const yesterday = flash(
  "flash-aptos",
  "2026-10-08T22:05:00+09:00",
  "アプトス財団、2.1億APTを永久ステーキング",
);

describe("FlashListCard (2026-10-09 田平氏 GO 案 A)", () => {
  it("renders each flash as an internal index-nav article link with its publish time", () => {
    const { container } = render(
      <FlashListCard articles={[today, yesterday]} copy={copy} locale="ja" />,
    );
    const section = container.querySelector("[data-flash-list]")!;
    expect(section.textContent).toContain(copy.title);

    const rows = [...section.querySelectorAll("a[data-article-id]")];
    expect(rows.map((row) => row.getAttribute("data-article-id"))).toEqual([
      "flash-mica",
      "flash-aptos",
    ]);
    expect(rows[0]!.getAttribute("href")).toBe("/articles/flash-mica");
    expect(rows[0]!.hasAttribute("data-index-nav")).toBe(true);
    expect(rows[0]!.textContent).toContain(today.titleJa);
    expect(rows[0]!.querySelector("time")?.textContent).toBe("10/09 09:40");
    expect(rows[1]!.querySelector("time")?.textContent).toBe("10/08 22:05");

    // 自社記事のみ: 外部リンク・一次ソースリンクは持たない。
    for (const anchor of section.querySelectorAll("a")) {
      expect(anchor.hasAttribute("target")).toBe(false);
      expect(anchor.hasAttribute("data-source-link")).toBe(false);
    }
  });

  it("ends with an index-nav link to the flash series page", () => {
    const { container } = render(
      <FlashListCard articles={[today]} copy={copy} locale="ja" />,
    );
    const anchors = [...container.querySelectorAll("a")];
    const seriesLink = anchors.at(-1)!;
    expect(seriesLink.getAttribute("href")).toBe("/articles/series/flash");
    expect(seriesLink.textContent).toContain(copy.seriesLink);
    expect(seriesLink.hasAttribute("data-index-nav")).toBe(true);
  });

  it("shows the empty message and the series link when there is no recent flash", () => {
    const { container } = render(
      <FlashListCard articles={[]} copy={copy} locale="ja" />,
    );
    expect(container.textContent).toContain(copy.empty);
    expect(container.querySelectorAll("[data-article-id]")).toHaveLength(0);
    expect(
      [...container.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href")),
    ).toEqual(["/articles/series/flash"]);
  });

  it("uses the English title on the en locale and falls back to Japanese", () => {
    const { container } = render(
      <FlashListCard articles={[today, yesterday]} copy={copy} locale="en" />,
    );
    const rows = [...container.querySelectorAll("a[data-article-id]")];
    expect(rows[0]!.textContent).toContain(today.titleEn);
    expect(rows[1]!.textContent).toContain(yesterday.titleJa);
  });
});
