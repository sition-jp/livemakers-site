/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { PriceCard } from "@/components/terminal/asset/PriceCard";
import type { Price } from "@/lib/terminal/asset-summary";
import type { LiveAssetEntry } from "@/lib/terminal/asset-live";

const STATIC: Price = {
  usd: 100.0,
  change_24h_pct: 1.0,
  market_cap_usd: 50_000_000_000,
  volume_24h_usd: 1_000_000_000,
  updated_at: "2026-04-30T06:00:00Z",
  source: "coingecko",
};

const LIVE: LiveAssetEntry = {
  price_usd: 123.45,
  change_24h_pct: 2.5,
  volume_24h_usd: 1_500_000_000,
  source: "coingecko",
  updated_at: "2026-04-30T12:00:00+09:00",
};

function renderCard(props: {
  asset?: string;
  price: Price | null;
  liveData?: LiveAssetEntry | null;
  liveStaleness?: number | null;
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages as any}>
      <PriceCard
        asset={props.asset ?? "Bitcoin"}
        price={props.price}
        liveData={props.liveData}
        liveStaleness={props.liveStaleness}
      />
    </NextIntlClientProvider>,
  );
}

describe("PriceCard — Day 3-4 live wiring", () => {
  describe("backwards compat (no liveData prop)", () => {
    it("renders static price when only `price` is provided", () => {
      renderCard({ price: STATIC });
      // 100 → "100.00" (1 ≤ value < 1000 path in formatUSD)
      expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
      expect(screen.getByTestId("price-change-24h").textContent).toContain("1.00%");
    });

    it("data-live-active='false' when liveData is undefined", () => {
      const { container } = renderCard({ price: STATIC });
      const section = container.querySelector("[data-live-active]");
      expect(section?.getAttribute("data-live-active")).toBe("false");
    });

    it("renders unavailable block when both price and liveData are null", () => {
      renderCard({ price: null, liveData: null });
      // After [P2] review fix: both the price slot AND the staleness badge
      // render "—" (price unavailable, badge tier=unavailable). Existence
      // of the unavailable indicator is what matters, count is allowed >=1.
      expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    });

    it("renders unavailable block with NO badge when price=null and liveData prop omitted (legacy caller)", () => {
      // Legacy static-only caller: PriceCard mounted without liveData prop.
      // Card stays visually identical to pre-Day-3 — just an "—" block.
      renderCard({ price: null });
      expect(
        screen.queryByTestId("price-staleness-badge"),
      ).not.toBeInTheDocument();
    });
  });

  describe("live preference", () => {
    it("renders live price when liveData has fresh values", () => {
      renderCard({ price: STATIC, liveData: LIVE });
      // Live price 123.45 should appear, not static 100.00
      expect(screen.getByText(/\$123\.45/)).toBeInTheDocument();
      expect(screen.queryByText(/\$100\.00/)).not.toBeInTheDocument();
      expect(screen.getByTestId("price-change-24h").textContent).toContain(
        "2.50%",
      );
    });

    it("data-live-active='true' when live overlay is active", () => {
      const { container } = renderCard({ price: STATIC, liveData: LIVE });
      const section = container.querySelector("[data-live-active]");
      expect(section?.getAttribute("data-live-active")).toBe("true");
    });

    it("keeps static market_cap when live overlay is active (live has none)", () => {
      renderCard({ price: STATIC, liveData: LIVE });
      // 50B from STATIC.market_cap_usd → "$50.00B"
      expect(screen.getByText("$50.00B")).toBeInTheDocument();
    });
  });

  describe("live unavailable / partial", () => {
    it("falls back to static when live.status === 'unavailable'", () => {
      const unavail: LiveAssetEntry = {
        price_usd: null,
        change_24h_pct: null,
        volume_24h_usd: null,
        source: "dexscreener",
        updated_at: null,
        status: "unavailable",
      };
      renderCard({ price: STATIC, liveData: unavail });
      expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
    });

    it("falls back to static when live.price_usd is null", () => {
      const partial: LiveAssetEntry = { ...LIVE, price_usd: null };
      renderCard({ price: STATIC, liveData: partial });
      expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
    });

    it("falls back to static when live.updated_at is null", () => {
      const partial: LiveAssetEntry = { ...LIVE, updated_at: null };
      renderCard({ price: STATIC, liveData: partial });
      expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
    });
  });

  describe("staleness badge — visibility (Day 5)", () => {
    it("does not render badge when liveData prop is undefined (legacy caller)", () => {
      renderCard({ price: STATIC });
      expect(
        screen.queryByTestId("price-staleness-badge"),
      ).not.toBeInTheDocument();
    });

    it("renders badge when liveData is null (live wired but asset entry missing)", () => {
      renderCard({ price: STATIC, liveData: null, liveStaleness: null });
      expect(screen.getByTestId("price-staleness-badge")).toBeInTheDocument();
    });

    it("renders badge when liveData is provided (asset has live entry)", () => {
      renderCard({ price: STATIC, liveData: LIVE, liveStaleness: 5 });
      expect(screen.getByTestId("price-staleness-badge")).toBeInTheDocument();
    });
  });

  describe("staleness badge — tier + colour (spec §4.3)", () => {
    it("liveStaleness=0 → live tier, green class, LIVE label", () => {
      renderCard({ price: STATIC, liveData: LIVE, liveStaleness: 0 });
      const badge = screen.getByTestId("price-staleness-badge");
      expect(badge.getAttribute("data-staleness-tier")).toBe("live");
      expect(badge.className).toContain("text-staleness-live");
      expect(badge.textContent).toContain("LIVE");
    });

    it("liveStaleness=59 → live tier (just below 60s threshold)", () => {
      renderCard({ price: STATIC, liveData: LIVE, liveStaleness: 59 });
      expect(
        screen
          .getByTestId("price-staleness-badge")
          .getAttribute("data-staleness-tier"),
      ).toBe("live");
    });

    it("liveStaleness=60 → slightly_stale tier, yellow class, shows seconds", () => {
      renderCard({ price: STATIC, liveData: LIVE, liveStaleness: 60 });
      const badge = screen.getByTestId("price-staleness-badge");
      expect(badge.getAttribute("data-staleness-tier")).toBe("slightly_stale");
      expect(badge.className).toContain("text-staleness-warn");
      expect(badge.textContent).toContain("60s");
    });

    it("liveStaleness=180 → stale tier, orange class, shows seconds", () => {
      renderCard({ price: STATIC, liveData: LIVE, liveStaleness: 180 });
      const badge = screen.getByTestId("price-staleness-badge");
      expect(badge.getAttribute("data-staleness-tier")).toBe("stale");
      expect(badge.className).toContain("text-staleness-stale");
      expect(badge.textContent).toContain("180s");
    });

    it("liveStaleness=360 → stale_hard tier, red class, STALE label (no seconds)", () => {
      renderCard({ price: STATIC, liveData: LIVE, liveStaleness: 360 });
      const badge = screen.getByTestId("price-staleness-badge");
      expect(badge.getAttribute("data-staleness-tier")).toBe("stale_hard");
      expect(badge.className).toContain("text-staleness-hard");
      expect(badge.textContent).toContain("STALE");
    });

    it("liveStaleness=null → unavailable tier, grey class, '—' label", () => {
      renderCard({ price: STATIC, liveData: null, liveStaleness: null });
      const badge = screen.getByTestId("price-staleness-badge");
      expect(badge.getAttribute("data-staleness-tier")).toBe("unavailable");
      expect(badge.className).toContain("text-text-tertiary");
      expect(badge.textContent).toContain("—");
    });

    it("NIGHT-style unavailable liveData → unavailable tier (badge present but grey)", () => {
      const unavail: LiveAssetEntry = {
        price_usd: null,
        change_24h_pct: null,
        volume_24h_usd: null,
        source: "dexscreener",
        updated_at: null,
        status: "unavailable",
      };
      renderCard({ price: STATIC, liveData: unavail, liveStaleness: null });
      const badge = screen.getByTestId("price-staleness-badge");
      expect(badge.getAttribute("data-staleness-tier")).toBe("unavailable");
      expect(badge.className).toContain("text-text-tertiary");
      // And static fallback price still shown (regression check)
      expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
    });
  });

  describe("staleness badge — unavailable branch (price=null + live wired) [P2 review fix]", () => {
    it("renders grey unavailable badge when price=null and liveData=null (pre-launch / live SWR loading)", () => {
      // The live lane is wired (liveData prop is present, even if currently
      // null) but no fresh data is available. Users should see both the "—"
      // price AND a grey "—" staleness badge so the live wiring status is
      // visible.
      renderCard({ price: null, liveData: null, liveStaleness: null });
      const badge = screen.getByTestId("price-staleness-badge");
      expect(badge.getAttribute("data-staleness-tier")).toBe("unavailable");
      expect(badge.className).toContain("text-text-tertiary");
      // Static-fallback "—" still rendered in the price slot
      expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    });

    it("renders grey unavailable badge when price=null and live.status='unavailable' (NIGHT in pre-launch)", () => {
      const unavail: LiveAssetEntry = {
        price_usd: null,
        change_24h_pct: null,
        volume_24h_usd: null,
        source: "dexscreener",
        updated_at: null,
        status: "unavailable",
      };
      renderCard({ price: null, liveData: unavail, liveStaleness: null });
      const badge = screen.getByTestId("price-staleness-badge");
      expect(badge.getAttribute("data-staleness-tier")).toBe("unavailable");
      expect(badge.className).toContain("text-text-tertiary");
    });

    it("data-live-active='false' on the section even in unavailable branch", () => {
      const { container } = renderCard({
        price: null,
        liveData: null,
        liveStaleness: null,
      });
      expect(
        container.querySelector("section")?.getAttribute("data-live-active"),
      ).toBe("false");
    });
  });

  describe("staleness badge — i18n", () => {
    it("renders Japanese 'ライブ' label when locale=ja", async () => {
      const jaMessages = (await import("@/messages/ja.json")).default;
      render(
        <NextIntlClientProvider locale="ja" messages={jaMessages as any}>
          <PriceCard
            asset="Bitcoin"
            price={STATIC}
            liveData={LIVE}
            liveStaleness={0}
          />
        </NextIntlClientProvider>,
      );
      expect(
        screen.getByTestId("price-staleness-badge").textContent,
      ).toContain("ライブ");
    });

    it("renders Japanese '遅延' label for stale_hard when locale=ja", async () => {
      const jaMessages = (await import("@/messages/ja.json")).default;
      render(
        <NextIntlClientProvider locale="ja" messages={jaMessages as any}>
          <PriceCard
            asset="Bitcoin"
            price={STATIC}
            liveData={LIVE}
            liveStaleness={500}
          />
        </NextIntlClientProvider>,
      );
      expect(
        screen.getByTestId("price-staleness-badge").textContent,
      ).toContain("遅延");
    });
  });
});
