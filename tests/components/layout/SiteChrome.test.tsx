/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { SiteChrome } from "@/components/layout/SiteChrome";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => <nav data-testid="site-header">Header</nav>,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <footer data-testid="site-footer">Footer</footer>,
}));

const mockedUsePathname = vi.mocked(usePathname);

describe("SiteChrome", () => {
  it("removes shared site chrome from terminal preview routes", () => {
    mockedUsePathname.mockReturnValue("/ja/terminal-preview");

    render(
      <SiteChrome>
        <div>Preview</div>
      </SiteChrome>,
    );

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.queryByTestId("site-header")).toBeNull();
    expect(screen.queryByTestId("site-footer")).toBeNull();
  });

  it("keeps shared site chrome for normal site routes", () => {
    mockedUsePathname.mockReturnValue("/ja/brief");

    render(
      <SiteChrome>
        <div>Brief</div>
      </SiteChrome>,
    );

    expect(screen.getByTestId("site-header")).toBeInTheDocument();
    expect(screen.getByText("Brief")).toBeInTheDocument();
    expect(screen.getByTestId("site-footer")).toBeInTheDocument();
  });
});
