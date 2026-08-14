/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { SiteChrome } from "@/components/layout/SiteChrome";

const chromeMeta = { dateLabel: "2026-07-10（金）", asOfLabel: "07:58 JST" };
const pageProvenance = {
  packetId: "lmk_20260710_0758_fx01",
  sourceMode: "fixture_only",
  reviewStatus: "reviewed_fixture",
  asOfJst: "07:58 JST",
} as const;
import type { MarketTickerItem } from "@/lib/terminal/market-lanes";

const chromeProps = {
  chromeMeta,
  tickerItems: [] as MarketTickerItem[],
  pageProvenance,
};

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
      <SiteChrome {...chromeProps} futureAtlasNav={false}>
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
      <SiteChrome {...chromeProps} futureAtlasNav={false}>
        <div>Inflow Preview</div>
      </SiteChrome>,
    );

    expect(screen.getByText("Inflow Preview")).toBeInTheDocument();
    expect(screen.queryByTestId("site-header")).toBeNull();
    expect(screen.queryByTestId("site-footer")).toBeNull();
  });

  it("keeps shared site chrome for normal site routes", () => {
    mockedUsePathname.mockReturnValue("/ja/brief");

    render(
      <SiteChrome {...chromeProps} futureAtlasNav={false}>
        <div>Brief</div>
      </SiteChrome>,
    );

    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    // 2026-08-14: ticker + 来歴帯も全ページ共通 chrome (3 段構成)
    expect(screen.getByTestId("site-ticker")).toBeInTheDocument();
    expect(screen.getByTestId("site-provenance")).toBeInTheDocument();
    expect(screen.getByText("Brief")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
  });
});
