/* @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
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
import { ForecastStatusChip } from "@/components/future-atlas/ForecastStatusChip";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";

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
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ja}>
      {await ArticleDetailPage({ params: Promise.resolve({ locale, slug }) })}
    </NextIntlClientProvider>,
  );
  const result = document.implementation.createHTMLDocument("Future Atlas article chrome");
  result.body.innerHTML = html;
  return result;
};

describe("Future Atlas article chrome", () => {
  it("uses canonical Japanese and English forecast status labels", () => {
    const labels = {
      ja: {
        open: "観測中",
        true: "的中",
        false: "外れ",
        indeterminate: "判定不能",
        void: "無効",
      },
      en: {
        open: "Monitoring",
        true: "Correct",
        false: "Incorrect",
        indeterminate: "Indeterminate",
        void: "Void",
      },
    } as const;

    for (const [locale, expected] of Object.entries(labels) as Array<["ja" | "en", typeof labels.ja]>) {
      for (const [status, label] of Object.entries(expected) as Array<[keyof typeof expected, string]>) {
        expect(renderToStaticMarkup(
          <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
            <ForecastStatusChip status={status} />
          </NextIntlClientProvider>,
        )).toContain(label);
      }
    }
  });

  it("keeps the forecast status chip sized to its label in a column layout", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="ja" messages={ja}>
        <ForecastStatusChip status="open" />
      </NextIntlClientProvider>,
    );

    expect(html).toContain("self-start");
  });

  it("keeps all Future Atlas reader copy in both locale message namespaces", () => {
    expect(ja.futureAtlas.status).toMatchObject({
      open: "観測中",
      overdue: "判定期限超過",
      withdrawn: "支持撤回",
    });
    expect(ja.futureAtlas.confidence).toMatchObject({
      leaning: "有力仮説",
      base_case: "基本シナリオ",
      high_conviction: "高確信",
    });
    expect(en.futureAtlas.surface.title).toBe("Future Atlas");
    expect(en.futureAtlas.authorship.human_written).toBeTruthy();
  });

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
    expect(block!.textContent).toContain("観測中");
    expect(block!.compareDocumentPosition(result.querySelector("[data-mdx-body]")!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const english = await renderPage("forecast-article", "en");
    const englishContract = english.querySelector("[data-atlas-contract=fc-one]")?.textContent;
    expect(englishContract).toContain("Base case");
    expect(englishContract).toContain("Monitoring");
    expect(englishContract).not.toContain("観測中");
  });

  it("joins every contract for one manifest-listed forecast article", async () => {
    setAtlasData({
      authorshipMode: "ai_draft_human_edited",
      contracts: [
        contract("fc-one"),
        contract("fc-two", {
          dueAt: "2028-01-20",
          resolutionCriteria: "fc-two の個別判定条件",
          confidence: "high_conviction",
        }),
      ],
    });

    const result = await renderPage("forecast-article");

    expect(result.querySelector("[data-atlas-authorship]")?.textContent).toBe("AI下書き · 田平茂樹が編集・検証・承認");
    expect(result.querySelectorAll("[data-atlas-contract]")).toHaveLength(2);
    expect(result.querySelector("[data-atlas-contract=fc-one]")?.textContent).toContain("fc-one の凍結主張");
    const second = result.querySelector("[data-atlas-contract=fc-two]");
    expect(second?.textContent).toContain("fc-two の凍結主張");
    expect(second?.textContent).toContain("2028-01-20");
    expect(second?.textContent).toContain("fc-two の個別判定条件");
    expect(second?.textContent).toContain("高確信");
    expect(second?.textContent).toContain("観測中");
  });

  it("renders only human authorship for a manifest-listed vision article", async () => {
    setAtlasData({ articleId: "vision-article", kind: "vision", contracts: [] });

    const result = await renderPage("vision-article");

    expect(result.querySelector("[data-atlas-authorship]")?.textContent).toBe("執筆: 田平茂樹 · 調査・検証補助にAIを使用");
    expect(result.querySelector("[data-atlas-contract]")).toBeNull();
  });

  it("preserves representative ordinary article markup without Future Atlas chrome", async () => {
    setAtlasData({ articleId: "different-atlas-article" });

    const result = await renderPage("ordinary-article");

    expect(result.querySelector("[data-atlas-authorship]")).toBeNull();
    expect(result.querySelector("[data-atlas-contract]")).toBeNull();
    expect(result.querySelector("header")?.textContent).toContain("テスト記事");
    expect(result.querySelector("[data-mdx-body]")?.textContent).toBe("本文");
    expect(Array.from(result.querySelector("article")!.children, (node) => node.tagName)).toEqual(["HEADER", "DIV"]);
  });
});
