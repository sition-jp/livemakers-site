/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TickerBar } from "@/components/terminal/TickerBar";
import type { MarketTickerItem } from "@/lib/terminal/market-lanes";

const liveItems: MarketTickerItem[] = [
  { id: "ticker.dxy", label: "DXY", value: "100.86", deltaPct: -0.7, badge: "SNAPSHOT" },
  { id: "ticker.btc", label: "BTC", value: "$62,579", deltaPct: 1.8, badge: "SNAPSHOT" },
];

describe("TickerBar (G39-B B2 live feed)", () => {
  it("shows the SNAPSHOT provenance pill for delivered items", () => {
    const { container } = render(<TickerBar items={liveItems} />);

    expect(screen.getByText("SNAPSHOT")).toBeInTheDocument();
    expect(screen.queryByText("Fixture")).toBeNull();
    expect(screen.getByText("$62,579")).toBeInTheDocument();
    // still informational — never a link
    expect(container.querySelector("a")).toBeNull();
  });

  it("keeps the Fixture pill when rendering the fallback fixture", () => {
    render(<TickerBar />);
    expect(screen.getByText("Fixture")).toBeInTheDocument();
  });

  it("labels mixed provenance explicitly instead of pretending LIVE", () => {
    render(
      <TickerBar
        items={[
          { id: "a", label: "DXY", value: "100.86", badge: "SNAPSHOT" },
          { id: "b", label: "ADA", value: "$0.179", badge: "SESSION" },
        ]}
      />,
    );
    expect(screen.getByText("SNAPSHOT · SESSION")).toBeInTheDocument();
    expect(screen.queryByText(/LIVE/)).toBeNull();
  });
});
