/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { resetChromeDataForTest } from "@/components/layout/useChromeData";

const chromeMeta = { dateLabel: "2026-07-10（金）", asOfLabel: "07:58 JST" };
const pageProvenance = {
  packetId: "lmk_20260710_0758_fx01",
  sourceMode: "fixture_only",
  reviewStatus: "reviewed_fixture",
  asOfJst: "07:58 JST",
} as const;
import type { MarketTickerItem } from "@/lib/terminal/market-lanes";

const chromeData = {
  chromeMeta,
  tickerItems: [] as MarketTickerItem[],
  pageProvenance,
};

// 2026-11-20: ticker と来歴帯の中身はブラウザが /api/chrome から読む
const chromeFetch = vi.fn(
  async () => new Response(JSON.stringify(chromeData), { status: 200 }),
);

beforeEach(() => {
  resetChromeDataForTest();
  chromeFetch.mockClear();
  vi.stubGlobal("fetch", chromeFetch);
});

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => <nav data-testid="site-header">Header</nav>,
}));

vi.mock("@/components/terminal/TickerBar", () => ({
  TickerBar: () => <div data-testid="site-ticker">Ticker</div>,
}));

vi.mock("@/components/home/GlobalProvenanceStrip", () => ({
  GlobalProvenanceStrip: () => (
    <div data-testid="site-provenance">Provenance</div>
  ),
}));

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <footer data-testid="site-footer">Footer</footer>,
}));

const mockedUsePathname = vi.mocked(usePathname);

describe("SiteChrome", () => {
  it("removes shared site chrome from terminal preview routes", () => {
    mockedUsePathname.mockReturnValue("/ja/terminal-preview");

    render(
      <SiteChrome futureAtlasNav={false}>
        <div>Preview</div>
      </SiteChrome>,
    );

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.queryByTestId("site-header")).toBeNull();
    expect(screen.queryByTestId("site-footer")).toBeNull();
  });

  it("removes shared site chrome from nested article inflow preview routes", () => {
    mockedUsePathname.mockReturnValue(
      "/ja/article-inflow-preview/articles/daily-intel-20260719-48cea1b8",
    );

    render(
      <SiteChrome futureAtlasNav={false}>
        <div>Inflow Preview</div>
      </SiteChrome>,
    );

    expect(screen.getByText("Inflow Preview")).toBeInTheDocument();
    expect(screen.queryByTestId("site-header")).toBeNull();
    expect(screen.queryByTestId("site-footer")).toBeNull();
  });

  it("keeps shared site chrome for normal site routes", async () => {
    mockedUsePathname.mockReturnValue("/ja/brief");

    render(
      <SiteChrome futureAtlasNav={false}>
        <div>Brief</div>
      </SiteChrome>,
    );

    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    // 2026-08-14: ticker + 来歴帯も全ページ共通 chrome (3 段構成)。
    // 2026-11-20: 中身はブラウザが /api/chrome から読んでから出す
    expect(await screen.findByTestId("site-ticker")).toBeInTheDocument();
    expect(chromeFetch).toHaveBeenCalledWith("/api/chrome");
    expect(screen.getByTestId("site-provenance")).toBeInTheDocument();
    expect(screen.getByText("Brief")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
  });

  it("keeps the chrome height with a placeholder strip until the market data arrives", () => {
    mockedUsePathname.mockReturnValue("/ja/articles/sig-1");
    chromeFetch.mockImplementationOnce(() => new Promise<Response>(() => {}));

    const { container } = render(
      <SiteChrome futureAtlasNav={false}>
        <div>Article</div>
      </SiteChrome>,
    );

    expect(container.querySelector('[data-chrome="pending"]')).not.toBeNull();
    expect(screen.queryByTestId("site-ticker")).toBeNull();
    expect(screen.getByText("Article")).toBeInTheDocument();
  });
});
