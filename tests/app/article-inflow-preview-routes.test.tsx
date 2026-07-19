/* @vitest-environment jsdom */
import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  loadDetail: vi.fn(),
  enabled: vi.fn(() => true),
  notFound: vi.fn((): never => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next-mdx-remote/rsc", () => ({
  MDXRemote: ({ source, options }: { source: string; options?: { mdxOptions?: { format?: string } } }) => (
    <div data-testid="rendered-markdown" data-source-format={options?.mdxOptions?.format}>{source}</div>
  ),
}));
vi.mock("remark-gfm", () => ({ default: vi.fn() }));
vi.mock("@/lib/articles/article-inflow-feed", () => ({
  loadArticleInflowPreviewCatalog: mocks.loadCatalog,
  loadArticleInflowPreviewDetail: mocks.loadDetail,
  isArticleInflowPreviewEnabled: mocks.enabled,
}));

import PreviewLayout from "@/app/[locale]/article-inflow-preview/layout";
import PreviewPage from "@/app/[locale]/article-inflow-preview/page";
import PreviewDetailPage from "@/app/[locale]/article-inflow-preview/articles/[slug]/page";
import PreviewSeriesPage from "@/app/[locale]/article-inflow-preview/series/[series]/page";

const checksum = "5df91fa04b4c09f201d60beb7c13c051f01e1c82d15bb55075742aba4875f7d8";
const articles = [
  {
    articleId: "repo-owned",
    family: "signal",
    titleJa: "Repository article",
    publishedAtJst: "2026-07-19T08:00:00+09:00",
    publishedLabel: "07-19 08:00 公開",
    lanes: [],
    href: "/article-inflow-preview/articles/repo-owned",
    source: "repository",
  },
  {
    articleId: "daily-intel-20260719-48cea1b8",
    family: "daily-intel",
    titleJa: "Feed article",
    publishedAtJst: "2026-07-19T07:20:14+09:00",
    publishedLabel: "07-19 07:20 公開",
    lanes: [],
    href: "/article-inflow-preview/articles/daily-intel-20260719-48cea1b8",
    source: "inflow",
    declaredBodyChecksum: checksum,
    inflowBody: "# Exact body\n",
  },
  {
    articleId: "session-20260719",
    family: "session",
    titleJa: "Session article",
    publishedAtJst: "2026-07-19T06:00:00+09:00",
    publishedLabel: "07-19 06:00 公開",
    lanes: [],
    href: "/article-inflow-preview/articles/session-20260719",
    source: "repository",
  },
];

beforeEach(() => {
  mocks.enabled.mockReturnValue(true);
  mocks.loadCatalog.mockResolvedValue({ articles, feedChecksum: "8f36d3924040c7aa" });
  mocks.loadDetail.mockResolvedValue({
    article: articles[1],
    body: "# Exact body\n",
    declaredBodyChecksum: checksum,
    renderedBodyChecksum: checksum,
  });
  mocks.notFound.mockClear();
});

describe("article inflow preview routes", () => {
  it("fails closed at the namespace layout when the flag is disabled", () => {
    mocks.enabled.mockReturnValue(false);
    expect(() => PreviewLayout({ children: <p>hidden</p> })).toThrow("NEXT_NOT_FOUND");
  });

  it("renders repository and feed articles using preview-only links", async () => {
    render(await PreviewPage({ params: Promise.resolve({ locale: "ja" }) }));
    expect(screen.getByText("Repository article")).toBeInTheDocument();
    expect(screen.getByText("Feed article")).toHaveAttribute(
      "href",
      "/article-inflow-preview/articles/daily-intel-20260719-48cea1b8",
    );
    expect(screen.getByTestId("article-inflow-feed-checksum")).toHaveTextContent("8f36d3924040c7aa");
  });

  it("does not offer a rejected series route for a session-family row", async () => {
    render(await PreviewPage({ params: Promise.resolve({ locale: "ja" }) }));
    const sessionRow = screen.getByText("Session article").closest("li");
    expect(sessionRow).not.toBeNull();
    expect(within(sessionRow!).queryByRole("link", { name: "series preview" })).toBeNull();
  });

  it("filters the shared catalog on a valid series", async () => {
    render(await PreviewSeriesPage({ params: Promise.resolve({ locale: "ja", series: "daily-intel" }) }));
    expect(screen.getByText("Feed article")).toBeInTheDocument();
    expect(screen.queryByText("Repository article")).toBeNull();
  });

  it("renders the exact body with matching declared and rendered checksums", async () => {
    render(await PreviewDetailPage({ params: Promise.resolve({ locale: "ja", slug: articles[1].articleId }) }));
    const body = screen.getByTestId("article-inflow-preview-body");
    expect(body).toHaveAttribute("data-declared-body-checksum", checksum);
    expect(body).toHaveAttribute("data-rendered-body-checksum", checksum);
    expect(screen.getByTestId("rendered-markdown")).toHaveTextContent("# Exact body");
    expect(screen.getByTestId("rendered-markdown")).toHaveAttribute("data-source-format", "md");
  });

  it("returns not found for an unknown detail slug", async () => {
    mocks.loadDetail.mockResolvedValue(null);
    await expect(
      PreviewDetailPage({ params: Promise.resolve({ locale: "ja", slug: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("keeps every route free of direct feed fetches", () => {
    const routeFiles = [
      "app/[locale]/article-inflow-preview/layout.tsx",
      "app/[locale]/article-inflow-preview/page.tsx",
      "app/[locale]/article-inflow-preview/series/[series]/page.tsx",
      "app/[locale]/article-inflow-preview/articles/[slug]/page.tsx",
    ];
    for (const relativePath of routeFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
      expect(source).not.toContain("fetch(");
    }
  });

  it("documents that the flag alone controls route availability", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "docs/article-inflow-preview.md"), "utf8");
    expect(source).toContain("The preview flag alone controls route availability.");
    expect(source).toContain("The feed URL is optional for route availability");
  });
});
