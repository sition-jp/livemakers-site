/* @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import FutureAtlasLedgerPage from "@/app/[locale]/future-atlas/ledger/page";
import FutureAtlasPage from "@/app/[locale]/future-atlas/page";
import { LedgerSummaryBand } from "@/components/future-atlas/LedgerSummaryBand";
import type { LedgerSummary } from "@/lib/future-atlas/snapshot";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";

type AtlasData = {
  config: { surfacePublished: boolean };
  manifest: {
    themes: Array<{ key: string; titleJa: string; titleEn?: string; order: number }>;
    entries: Array<{
      articleId: string;
      kind: "vision" | "structural_report" | "forecast";
      themes: string[];
      atlasPlacement: number;
      authorDisplay: string;
      authorshipMode: "human_written" | "ai_draft_human_edited";
    }>;
  };
  contracts: Array<{
    forecastId: string;
    articleId: string;
    claim: string;
    dueAt: string;
    confidence: "leaning" | "base_case" | "high_conviction";
    resolutionSources: string[];
  }>;
  states: Map<string, {
    forecastId: string;
    endorsementStatus: "active" | "withdrawn";
    resolutionStatus: "open" | "true" | "false" | "indeterminate" | "void";
    resolvedByEventId: string | null;
    supersededByForecastId: string | null;
    history: Array<Record<string, unknown>>;
  }>;
  articles: Map<string, { articleId: string; titleJa: string; titleEn?: string; href: string }>;
};

let atlasData: AtlasData;
const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error("not-found");
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next-intl/server", async () => {
  const { default: japanese } = await import("@/messages/ja.json");
  const { default: english } = await import("@/messages/en.json");

  return {
    setRequestLocale: vi.fn(),
    getTranslations: async ({ locale, namespace }: { locale: "ja" | "en"; namespace: string }) => {
      const scoped = namespace.split(".").reduce<unknown>(
        (value, key) => (value as Record<string, unknown>)[key],
        locale === "ja" ? japanese : english,
      ) as Record<string, string>;
      return (key: string) => scoped[key];
    },
  };
});
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/future-atlas/load", () => ({
  loadFutureAtlas: vi.fn(async () => atlasData),
}));

const emptyAtlas = (): AtlasData => ({
  config: { surfacePublished: false },
  manifest: { themes: [], entries: [] },
  contracts: [],
  states: new Map(),
  articles: new Map(),
});

const REQUIRED_COUNT_ANCHORS = [
  "total",
  "open",
  "overdue",
  "true",
  "false",
  "indeterminate",
  "void",
  "withdrawn",
] as const;

const asDocument = (html: string): Document => {
  const result = document.implementation.createHTMLDocument("Future Atlas");
  result.body.innerHTML = html;
  return result;
};

const renderWithMessages = (locale: "ja" | "en", element: React.ReactNode): string =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
      {element}
    </NextIntlClientProvider>,
  );

const renderLedger = async (locale: "ja" | "en" = "ja"): Promise<Document> =>
  asDocument(renderWithMessages(
    locale,
    await FutureAtlasLedgerPage({ params: Promise.resolve({ locale }) }),
  ));

const forecastRow = (result: Document, forecastId: string): HTMLElement => {
  const row = result.querySelector<HTMLElement>(`[data-atlas-forecast="${forecastId}"]`);
  expect(row, `missing forecast row for ${forecastId}`).not.toBeNull();
  return row!;
};

const auditDetail = (row: HTMLElement, audit: string): HTMLElement => {
  const detail = row.querySelector<HTMLElement>(`[data-atlas-audit="${audit}"]`);
  expect(detail, `missing ${audit} for ${row.dataset.atlasForecast}`).not.toBeNull();
  return detail!;
};

const atlasFixture = (): AtlasData => {
  const contracts: AtlasData["contracts"] = [
    {
      forecastId: "fc-withdrawn",
      articleId: "forecast-withdrawn",
      claim: "撤回しても凍結原文は残る",
      dueAt: "2027-08-01",
      confidence: "leaning",
      resolutionSources: ["撤回前の一次資料"],
    },
    {
      forecastId: "fc-true",
      articleId: "forecast-true",
      claim: "真の判定を監査できる",
      dueAt: "2027-08-02",
      confidence: "base_case",
      resolutionSources: ["公式発表"],
    },
    {
      forecastId: "fc-correction",
      articleId: "forecast-correction",
      claim: "誤判定の訂正履歴を残す",
      dueAt: "2027-08-03",
      confidence: "high_conviction",
      resolutionSources: ["判定時の一次資料"],
    },
    {
      forecastId: "fc-successor",
      articleId: "forecast-successor",
      claim: "更新版への導線を残す",
      dueAt: "2027-08-04",
      confidence: "base_case",
      resolutionSources: ["更新資料"],
    },
  ];
  const state = (
    forecastId: string,
    resolutionStatus: AtlasData["states"] extends Map<string, infer Value>
      ? Value extends { resolutionStatus: infer Status } ? Status : never : never,
    history: Array<Record<string, unknown>> = [],
    overrides: Partial<AtlasData["states"] extends Map<string, infer Value> ? Value : never> = {},
  ) => ({
    forecastId,
    endorsementStatus: "active" as const,
    resolutionStatus,
    resolvedByEventId: null,
    supersededByForecastId: null,
    history,
    ...overrides,
  });

  return {
    config: { surfacePublished: true },
    manifest: {
      themes: [
        { key: "ai", titleJa: "AI", titleEn: "AI", order: 0 },
        { key: "finance", titleJa: "金融", titleEn: "Finance", order: 1 },
      ],
      entries: [
        { articleId: "vision", kind: "vision", themes: ["ai"], atlasPlacement: 0, authorDisplay: "田平", authorshipMode: "human_written" },
        { articleId: "structural", kind: "structural_report", themes: ["ai", "finance"], atlasPlacement: 1, authorDisplay: "田平", authorshipMode: "human_written" },
        ...contracts.map((contract, atlasPlacement) => ({
          articleId: contract.articleId,
          kind: "forecast" as const,
          themes: atlasPlacement === 3 ? ["finance"] : ["ai"],
          atlasPlacement: atlasPlacement + 2,
          authorDisplay: "田平",
          authorshipMode: "human_written" as const,
        })),
      ],
    },
    contracts,
    states: new Map([
      ["fc-withdrawn", state("fc-withdrawn", "open", [{
        type: "endorsement_withdrawn", note: "検証可能性が失われたため撤回", materials: [],
      }], { endorsementStatus: "withdrawn" })],
      ["fc-true", state("fc-true", "true", [{
        type: "resolution", eventId: "ev-true", articleId: "resolution-article", materials: ["公式発表の資料"], resolutionStatus: "true",
      }], { resolvedByEventId: "ev-true" })],
      ["fc-correction", state("fc-correction", "false", [
        { type: "resolution", eventId: "ev-original", articleId: "original-resolution", materials: ["初回資料"], resolutionStatus: "true" },
        { type: "resolution_correction", eventId: "ev-correction", correctionArticleId: "correction-article", materials: ["訂正資料"], resolutionStatus: "false", reason: "再検証で誤りを確認" },
      ], { resolvedByEventId: "ev-correction" })],
      ["fc-successor", state("fc-successor", "open", [{
        type: "update", supersededByForecastId: "fc-true", note: "更新版を公開", materials: [],
      }], { supersededByForecastId: "fc-true" })],
    ]),
    articles: new Map<string, { articleId: string; titleJa: string; titleEn?: string; href: string }>([
      ["vision", { articleId: "vision", titleJa: "展望記事", href: "/articles/vision" }],
      ["structural", { articleId: "structural", titleJa: "構造レポート", href: "/articles/structural" }],
      ...contracts.map((contract) => [contract.articleId, {
        articleId: contract.articleId,
        titleJa: `記事 ${contract.forecastId}`,
        titleEn: `Article ${contract.forecastId}`,
        href: `/articles/${contract.articleId}`,
      }] as const),
      ["resolution-article", { articleId: "resolution-article", titleJa: "判定記事", href: "/articles/resolution-article" }],
      ["original-resolution", { articleId: "original-resolution", titleJa: "原判定記事", href: "/articles/original-resolution" }],
      ["correction-article", { articleId: "correction-article", titleJa: "訂正記事", href: "/articles/correction-article" }],
    ]),
  };
};

describe("Future Atlas routes", () => {
  it("renders a non-null hit rate as a visible ledger metric", () => {
    const summary: LedgerSummary = {
      total: 10,
      open: 0,
      overdue: 0,
      trueCount: 6,
      falseCount: 4,
      indeterminate: 0,
      voidCount: 0,
      withdrawn: 0,
      binaryResolved: 10,
      hitRate: 0.6,
      nonBinaryResolutionRate: null,
      warnings: [],
    };

    const html = renderWithMessages("ja", <LedgerSummaryBand summary={summary} />);

    expect(html).toContain('data-atlas-hit-rate="60%"');
    expect(html).toContain("的中率 60%");
    expect(html).not.toContain("sr-only");
  });

  it("renders a non-binary resolution rate in a dedicated ratio row", () => {
    const summary: LedgerSummary = {
      total: 6,
      open: 0,
      overdue: 0,
      trueCount: 2,
      falseCount: 2,
      indeterminate: 1,
      voidCount: 1,
      withdrawn: 0,
      binaryResolved: 4,
      hitRate: null,
      nonBinaryResolutionRate: 2 / 6,
      warnings: [],
    };

    const result = asDocument(renderWithMessages("ja", <LedgerSummaryBand summary={summary} />));

    expect(result.querySelector('[data-atlas-non-binary-resolution-rate="33%"]')?.textContent)
      .toContain("非二値判定率 33%");
    const ratios = result.querySelector<HTMLElement>("[data-atlas-ratios]");
    expect(ratios).not.toBeNull();
    expect(ratios?.className).toContain("sm:grid-flow-col");
    expect(ratios?.className).toContain("sm:auto-cols-fr");
    expect(ratios?.className).not.toContain("sm:grid-cols-2");
    expect(result.querySelector("[data-atlas-ratios] [data-atlas-count]"))?.toBeNull();
  });

  it("calls notFound only for the unpublished surface", async () => {
    atlasData = emptyAtlas();
    notFound.mockClear();

    await expect(FutureAtlasPage({ params: Promise.resolve({ locale: "ja" }) })).rejects.toThrow("not-found");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders an empty ledger with all eight summary anchors while the flag is false", async () => {
    atlasData = emptyAtlas();
    notFound.mockClear();

    const result = await renderLedger();
    expect(
      Array.from(result.querySelectorAll<HTMLElement>("[data-atlas-count]"), (anchor) => anchor.dataset.atlasCount),
    ).toEqual(REQUIRED_COUNT_ANCHORS);
    expect(result.body.textContent).toContain("登録 0 件");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders the published surface definition, methodology link, summary, and mixed format shelves", async () => {
    atlasData = atlasFixture();
    const result = asDocument(renderWithMessages(
      "ja",
      await FutureAtlasPage({ params: Promise.resolve({ locale: "ja" }) }),
    ));
    expect(result.body.textContent).toContain("未来を断言せず、検証可能な見立てを台帳として残す");
    expect(result.querySelector('a[href="/future-atlas/methodology"]')?.textContent).toBe("未来予測の作法");
    expect(result.querySelector("[data-atlas-count=total]")?.textContent).toBe("4");
    expect(
      Array.from(result.querySelectorAll<HTMLElement>("[data-atlas-format]"), (chip) => ({
        format: chip.dataset.atlasFormat,
        label: chip.textContent,
      })),
    ).toEqual([
      { format: "vision", label: "展望" },
      { format: "structural_report", label: "構造レポート" },
      { format: "forecast", label: "未来予測" },
      { format: "forecast", label: "未来予測" },
      { format: "forecast", label: "未来予測" },
      { format: "structural_report", label: "構造レポート" },
      { format: "forecast", label: "未来予測" },
    ]);
  });

  it("renders the English surface, shelf titles, and ledger article titles from localized data", async () => {
    atlasData = atlasFixture();

    const surface = asDocument(renderWithMessages(
      "en",
      await FutureAtlasPage({ params: Promise.resolve({ locale: "en" }) }),
    ));
    const ledger = await renderLedger("en");

    expect(surface.body.textContent).toContain("Future Atlas");
    expect(surface.body.textContent).toContain("Record testable views without claiming certainty about the future.");
    expect(surface.querySelector('a[href="/future-atlas/methodology"]')?.textContent).toBe("Forecast methodology");
    expect(surface.body.textContent).toContain("Finance");
    expect(Array.from(surface.querySelectorAll("[data-atlas-format]"), (chip) => chip.textContent))
      .toContain("Forecast");
    expect(ledger.body.textContent).toContain("Forecast ledger");
    expect(forecastRow(ledger, "fc-true").textContent).toContain("Article fc-true");
    expect(forecastRow(ledger, "fc-true").textContent).toContain("Base case");
  });

  it("hides hit rate below ten binary resolutions and renders all forecast audit records", async () => {
    atlasData = atlasFixture();
    const result = await renderLedger();
    expect(result.querySelector("[data-atlas-hit-rate]")).toBeNull();

    const withdrawn = forecastRow(result, "fc-withdrawn");
    expect(withdrawn.textContent).toContain("撤回しても凍結原文は残る");
    expect(withdrawn.textContent).toContain("観測中");
    expect(withdrawn.textContent).toContain("期日: 2027-08-01");
    expect(withdrawn.textContent).toContain("確信度: 有力仮説");
    expect(auditDetail(withdrawn, "resolution-sources").textContent).toContain("撤回前の一次資料");
    expect(auditDetail(withdrawn, "withdrawal-reason").textContent).toContain("検証可能性が失われたため撤回");

    const resolved = forecastRow(result, "fc-true");
    expect(resolved.textContent).toContain("的中");
    expect(resolved.textContent).toContain("期日: 2027-08-02");
    expect(resolved.textContent).toContain("確信度: 基本シナリオ");
    expect(resolved.textContent).toContain("真の判定を監査できる");
    expect(auditDetail(resolved, "resolution-sources").textContent).toContain("公式発表");
    expect(auditDetail(resolved, "resolution-article").textContent).toContain("判定記事");
    expect(auditDetail(resolved, "resolution-materials").textContent).toContain("公式発表の資料");

    const corrected = forecastRow(result, "fc-correction");
    expect(corrected.textContent).toContain("誤判定の訂正履歴を残す");
    expect(corrected.textContent).toContain("外れ");
    expect(corrected.textContent).toContain("期日: 2027-08-03");
    expect(corrected.textContent).toContain("確信度: 高確信");
    expect(auditDetail(corrected, "resolution-sources").textContent).toContain("判定時の一次資料");
    const correctionHistory = auditDetail(corrected, "correction-history").textContent ?? "";
    const originalResolutionIndex = correctionHistory.indexOf("ev-original");
    const correctionIndex = correctionHistory.indexOf("ev-correction");
    expect(originalResolutionIndex).toBeGreaterThanOrEqual(0);
    expect(correctionIndex).toBeGreaterThan(originalResolutionIndex);
    expect(correctionHistory).toContain("的中");
    expect(correctionHistory).toContain("外れ");
    expect(correctionHistory).not.toMatch(/\btrue\b|\bfalse\b/);

    const successor = forecastRow(result, "fc-successor");
    expect(successor.textContent).toContain("更新版への導線を残す");
    expect(successor.textContent).toContain("観測中");
    expect(successor.textContent).toContain("期日: 2027-08-04");
    expect(successor.textContent).toContain("確信度: 基本シナリオ");
    expect(auditDetail(successor, "resolution-sources").textContent).toContain("更新資料");
    const successorLink = auditDetail(successor, "superseded-by").querySelector('a[href="/articles/forecast-true"]');
    expect(successorLink?.textContent).toBe("記事 fc-true");
  });

  it("locks the injected JST overdue boundary at fourteen and fifteen days", async () => {
    const snapshot = await import("@/lib/future-atlas/snapshot");
    const state = {
      forecastId: "fc-boundary",
      dueAt: "2026-07-01",
      confidence: "base_case" as const,
      endorsementStatus: "active" as const,
      resolutionStatus: "open" as const,
      resolvedByEventId: null,
      supersededByForecastId: null,
      history: [],
    };

    expect(snapshot.deriveOverdue(state, "2026-07-15").overdue).toBe(false);
    expect(snapshot.deriveOverdue(state, "2026-07-16").overdue).toBe(true);
  });
});
