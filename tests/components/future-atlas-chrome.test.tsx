/* @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

type ContractFixture = {
  forecastId: string;
  articleId: string;
  claim: string;
  dueAt: string;
  resolutionCriteria: string;
  confidence: "leaning" | "base_case" | "high_conviction";
};

type ChromeAtlasData = {
  config: { surfacePublished: boolean };
  manifest: {
    themes: Array<unknown>;
    entries: Array<{
      articleId: string;
      kind: "vision" | "structural_report" | "forecast";
      themes: string[];
      atlasPlacement: number;
      relatedArticleIds: string[];
      authorDisplay: string;
      authorshipMode: "human_written" | "ai_draft_human_edited";
    }>;
  };
  contracts: ContractFixture[];
  states: Map<string, ReturnType<typeof openState>>;
  articles: Map<string, unknown>;
};

const atlasState = vi.hoisted(() => ({
  data: {} as ChromeAtlasData,
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => (key: string) => key,
}));
vi.mock("next-mdx-remote/rsc", () => ({
  MDXRemote: ({ source }: { source: string }) => <div data-mdx-body>{source}</div>,
}));
vi.mock("@/components/home/ArticleRow", () => ({
  FAMILY_COLORS: { "future-map": "#000", signal: "#000" },
}));
vi.mock("@/lib/articles/article-model", () => ({
  getAllArticles: vi.fn(() => []),
  getArticleBySlug: vi.fn((articleId: string) => ({
    articleId,
    family: articleId === "ordinary-article" ? "signal" : "future-map",
    titleJa: "テスト記事",
    publishedAtJst: "2026-07-18T09:00:00+09:00",
    publishedLabel: "2026-07-18",
  })),
  getArticleBody: vi.fn(() => "本文"),
}));
vi.mock("@/lib/future-atlas/load", () => ({
  loadFutureAtlas: vi.fn(async () => atlasState.data),
}));

import ArticleDetailPage from "@/app/[locale]/articles/[slug]/page";

const contract = (forecastId: string, overrides: Partial<ContractFixture> = {}): ContractFixture => ({
  forecastId,
  articleId: "forecast-article",
  claim: `${forecastId} の凍結主張`,
  dueAt: "2027-07-18",
  resolutionCriteria: `${forecastId} の判定条件`,
  confidence: "base_case",
  ...overrides,
});

const openState = (forecastId: string) => ({
  forecastId,
  endorsementStatus: "active",
  resolutionStatus: "open",
  resolvedByEventId: null,
  supersededByForecastId: null,
  history: [],
});

const setAtlasData = ({
  articleId = "forecast-article",
  kind = "forecast",
  authorshipMode = "human_written",
  contracts = [contract("fc-one")],
}: {
  articleId?: string;
  kind?: "vision" | "structural_report" | "forecast";
  authorshipMode?: "human_written" | "ai_draft_human_edited";
  contracts?: ContractFixture[];
} = {}) => {
  atlasState.data = {
    config: { surfacePublished: false },
    manifest: {
      themes: [],
      entries: [{
        articleId,
        kind,
        themes: ["ai"],
        atlasPlacement: 0,
        relatedArticleIds: [],
        authorDisplay: "田平茂樹",
        authorshipMode,
      }],
    },
    contracts,
    states: new Map(contracts.map((item) => [item.forecastId, openState(item.forecastId)])),
    articles: new Map(),
  };
};

const renderPage = async (slug: string, locale = "ja"): Promise<Document> => {
  const html = renderToStaticMarkup(await ArticleDetailPage({
    params: Promise.resolve({ locale, slug }),
  }));
  const result = document.implementation.createHTMLDocument("Future Atlas article chrome");
  result.body.innerHTML = html;
  return result;
};

describe("Future Atlas article chrome", () => {
  it("renders the manifest-listed forecast contract immediately after the header", async () => {
    setAtlasData();

    const result = await renderPage("forecast-article");
    const article = result.querySelector("article")!;
    const header = article.querySelector("header")!;
    const authorship = article.querySelector("[data-atlas-authorship]")!;
    const block = result.querySelector<HTMLElement>("[data-atlas-contract=fc-one]");

    expect(authorship.textContent).toBe("執筆: 田平茂樹 · 調査・検証補助にAIを使用");
    expect(header.nextElementSibling).toBe(authorship);
    expect(block).not.toBeNull();
    expect(block!.textContent).toContain("fc-one の凍結主張");
    expect(block!.textContent).toContain("2027-07-18");
    expect(block!.textContent).toContain("fc-one の判定条件");
    expect(block!.textContent).toContain("基本シナリオ");
    expect(block!.textContent).toContain("判定待ち");
    expect(block!.compareDocumentPosition(result.querySelector("[data-mdx-body]")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const english = await renderPage("forecast-article", "en");
    expect(english.querySelector("[data-atlas-contract=fc-one]")?.textContent).toContain("Base case");
  });

  it("joins every contract for one manifest-listed forecast article", async () => {
    setAtlasData({
      authorshipMode: "ai_draft_human_edited",
      contracts: [contract("fc-one"), contract("fc-two", { confidence: "high_conviction" })],
    });

    const result = await renderPage("forecast-article");

    expect(result.querySelector("[data-atlas-authorship]")?.textContent).toBe("AI下書き · 田平茂樹が編集・検証・承認");
    expect(result.querySelectorAll("[data-atlas-contract]")).toHaveLength(2);
    expect(result.querySelector("[data-atlas-contract=fc-one]")?.textContent).toContain("fc-one の凍結主張");
    const second = result.querySelector("[data-atlas-contract=fc-two]");
    expect(second?.textContent).toContain("fc-two の凍結主張");
    expect(second?.textContent).toContain("高確信");
  });

  it("renders only human authorship for a manifest-listed vision article", async () => {
    setAtlasData({ articleId: "vision-article", kind: "vision", contracts: [] });

    const result = await renderPage("vision-article");

    expect(result.querySelector("[data-atlas-authorship]")?.textContent).toBe("執筆: 田平茂樹 · 調査・検証補助にAIを使用");
    expect(result.querySelector("[data-atlas-contract]")).toBeNull();
  });

  it("adds no chrome to a manifest-unlisted ordinary article", async () => {
    setAtlasData({ articleId: "different-atlas-article" });

    const result = await renderPage("ordinary-article");

    expect(result.querySelector("[data-atlas-authorship]")).toBeNull();
    expect(result.querySelector("[data-atlas-contract]")).toBeNull();
  });
});
