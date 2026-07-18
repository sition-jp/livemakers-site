/* @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

type AtlasData = {
  config: { surfacePublished: boolean };
  manifest: {
    themes: Array<{ key: string; titleJa: string; order: number }>;
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
  articles: Map<string, { articleId: string; titleJa: string; href: string }>;
};

let atlasData: AtlasData;
const notFound = vi.fn(() => {
  throw new Error("not-found");
});

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
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
        { key: "ai", titleJa: "AI", order: 0 },
        { key: "finance", titleJa: "金融", order: 1 },
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
    articles: new Map([
      ["vision", { articleId: "vision", titleJa: "展望記事", href: "/articles/vision" }],
      ["structural", { articleId: "structural", titleJa: "構造レポート", href: "/articles/structural" }],
      ...contracts.map((contract) => [contract.articleId, {
        articleId: contract.articleId,
        titleJa: `記事 ${contract.forecastId}`,
        href: `/articles/${contract.articleId}`,
      }] as const),
      ["resolution-article", { articleId: "resolution-article", titleJa: "判定記事", href: "/articles/resolution-article" }],
      ["original-resolution", { articleId: "original-resolution", titleJa: "原判定記事", href: "/articles/original-resolution" }],
      ["correction-article", { articleId: "correction-article", titleJa: "訂正記事", href: "/articles/correction-article" }],
    ]),
  };
};

async function importRoute(path: string) {
  return import(/* @vite-ignore */ path).catch(() => null);
}

describe("Future Atlas routes", () => {
  it("provides the T7 surface and always-public ledger route modules", async () => {
    const [surface, ledger] = await Promise.all([
      importRoute("../../app/[locale]/future-atlas/page"),
      importRoute("../../app/[locale]/future-atlas/ledger/page"),
    ]);

    expect(surface).not.toBeNull();
    expect(ledger).not.toBeNull();
  });

  it("calls notFound only for the unpublished surface", async () => {
    atlasData = emptyAtlas();
    notFound.mockClear();
    const surface = await importRoute("../../app/[locale]/future-atlas/page");
    if (!surface) {
      expect(surface).not.toBeNull();
      return;
    }

    await expect(surface.default({ params: Promise.resolve({ locale: "ja" }) })).rejects.toThrow("not-found");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("renders an empty ledger with all eight summary anchors while the flag is false", async () => {
    atlasData = emptyAtlas();
    notFound.mockClear();
    const ledger = await importRoute("../../app/[locale]/future-atlas/ledger/page");
    if (!ledger) {
      expect(ledger).not.toBeNull();
      return;
    }

    const html = renderToStaticMarkup(await ledger.default({ params: Promise.resolve({ locale: "ja" }) }));
    for (const count of ["total", "open", "overdue", "true", "false", "indeterminate", "void", "withdrawn"]) {
      expect(html).toContain(`data-atlas-count="${count}"`);
    }
    expect(html).toContain("登録 0 件");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders the published surface definition, methodology link, summary, and mixed format shelves", async () => {
    atlasData = atlasFixture();
    const surface = await importRoute("../../app/[locale]/future-atlas/page");
    if (!surface) {
      expect(surface).not.toBeNull();
      return;
    }

    const html = renderToStaticMarkup(await surface.default({ params: Promise.resolve({ locale: "ja" }) }));
    expect(html).toContain("未来を断言せず、検証可能な見立てを台帳として残す");
    expect(html).toContain('href="/future-atlas/methodology"');
    expect(html).toContain('data-atlas-count="total"');
    expect(html).toContain("展望");
    expect(html).toContain("構造レポート");
    expect(html).toContain("未来予測");
  });

  it("hides hit rate below ten binary resolutions and renders all forecast audit records", async () => {
    atlasData = atlasFixture();
    const ledger = await importRoute("../../app/[locale]/future-atlas/ledger/page");
    if (!ledger) {
      expect(ledger).not.toBeNull();
      return;
    }

    const html = renderToStaticMarkup(await ledger.default({ params: Promise.resolve({ locale: "ja" }) }));
    expect(html).not.toContain("的中率");
    for (const forecastId of ["fc-withdrawn", "fc-true", "fc-correction", "fc-successor"]) {
      expect(html).toContain(forecastId);
    }
    expect(html).toContain("判定: 的中");
    expect(html).toContain("期日: 2027-08-02");
    expect(html).toContain("確信度: ベースケース");
    expect(html).toContain('data-atlas-audit="resolution-sources"');
    expect(html).toContain("公式発表");
    expect(html).toContain('data-atlas-audit="withdrawal-reason"');
    expect(html).toContain("検証可能性が失われたため撤回");
    expect(html).toContain('data-atlas-audit="resolution-article"');
    expect(html).toContain("判定記事");
    expect(html).toContain('data-atlas-audit="resolution-materials"');
    expect(html).toContain("公式発表の資料");
    expect(html).toContain('data-atlas-audit="correction-history"');
    expect(html).toContain("ev-original");
    expect(html).toContain("ev-correction");
    expect(html).toContain('data-atlas-audit="superseded-by"');
    expect(html).toContain("更新版あり");
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
