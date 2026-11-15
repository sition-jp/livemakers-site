/* @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ja from "@/messages/ja.json";
import en from "@/messages/en.json";
import sample from "@/tests/fixtures/pivots/tp-v2.sample.json";
import { RegimeHeadline } from "@/components/turning-points/RegimeHeadline";
import { RangeBandChart } from "@/components/turning-points/RangeBandChart";
import { WhatIsThis } from "@/components/turning-points/WhatIsThis";
import { WorkedExample } from "@/components/turning-points/WorkedExample";
import { WhatItDoesNotTell } from "@/components/turning-points/WhatItDoesNotTell";
import { TurnCards } from "@/components/turning-points/TurnCards";
import type { RegimeOne } from "@/lib/pivots/regime";
import type { RangeBandOne } from "@/lib/pivots/range-band";
import type { ForecastItem, LadderRow, TurnRate } from "@/lib/pivots/types";

afterEach(cleanup);

function wrap(locale: "ja" | "en", ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ja" ? ja : en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const BANNED = [/予測/, /上がる/, /下がる/, /反転幅/, /predict/i, /goes up/i, /goes down/i];
function expectClean(text: string) {
  for (const re of BANNED) expect(text).not.toMatch(re);
}

const s = sample as unknown as {
  regime: Record<string, RegimeOne>;
  range_band: Record<string, RangeBandOne>;
  ladder: Record<string, LadderRow[]>;
  turn_rate: TurnRate;
  forecast: Record<string, ForecastItem[]>;
};
const btc = s.regime.BTC; // long=down / mid=crash / near=down / shock
const eth = s.regime.ETH; // long=recovering / mid=range / near=down / no shock
const band = s.range_band.BTC;
const history = Array.from({ length: 61 }, (_, i) => ({
  date: `2026-09-${String(16 + Math.min(i, 14)).padStart(2, "0")}`,
  close: 64000 + (i % 7) * 400,
}));

describe("RegimeHeadline", () => {
  it("starts on the long chip and switches the headline on click", () => {
    wrap("ja", <RegimeHeadline asset="BTC" regime={btc} />);
    const h = screen.getByTestId("regime-headline");
    expect(h.textContent).toContain("大きな流れは下げ相場です。");
    expect(h.getAttribute("aria-live")).toBe("polite");
    const longChip = screen.getByTestId("regime-chip-long");
    const nearChip = screen.getByTestId("regime-chip-near");
    expect(longChip.getAttribute("aria-pressed")).toBe("true");
    expect(nearChip.getAttribute("aria-pressed")).toBe("false");
    expect(longChip.getAttribute("type")).toBe("button");

    fireEvent.click(nearChip);
    expect(screen.getByTestId("regime-headline").textContent).toContain("この 30 日は下げています");
    expect(screen.getByTestId("regime-headline").textContent).not.toContain("大きな流れ");
    expect(nearChip.getAttribute("aria-pressed")).toBe("true");
    expect(longChip.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByTestId("regime-chip-mid"));
    expect(screen.getByTestId("regime-headline").textContent).toContain("暴落");
    expect(screen.getByTestId("regime-chip-mid").getAttribute("aria-pressed")).toBe("true");
  });

  it("falls back to the near-only headline when there is no long block", () => {
    wrap("ja", <RegimeHeadline asset="BTC" regime={{ ...btc, long: null }} />);
    const h = screen.getByTestId("regime-headline").textContent!;
    expect(h).toContain("この 30 日は下げています");
    expect(h).not.toContain("大きな流れ");
    expect(screen.queryByTestId("regime-chip-long")).toBeNull();
    expect(screen.getByTestId("regime-chip-near").getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the crash sentence only when shock is present, whatever chip is chosen", () => {
    wrap("ja", <RegimeHeadline asset="BTC" regime={btc} />);
    expect(screen.getByTestId("regime-shock").textContent).toContain("暴落");
    fireEvent.click(screen.getByTestId("regime-chip-near"));
    expect(screen.getByTestId("regime-shock")).toBeTruthy();
    cleanup();
    wrap("ja", <RegimeHeadline asset="ETH" regime={eth} />);
    expect(screen.queryByTestId("regime-shock")).toBeNull();
  });

  it("states when the long label would change", () => {
    wrap("ja", <RegimeHeadline asset="ETH" regime={eth} />);
    expect(screen.getByTestId("regime-flip-note").textContent).toContain("1,909");
  });

  it("renders nothing without a regime", () => {
    const { container } = wrap("ja", <RegimeHeadline asset="BTC" regime={null} />);
    expect(container.textContent).toBe("");
    const r2 = wrap("ja", <RegimeHeadline asset="BTC" regime={{ as_of: "2026-11-15", long: null, mid: null, near: null }} />);
    expect(r2.container.textContent).toBe("");
  });
});

describe("RangeBandChart", () => {
  it("draws an accessible svg and a legend with widths, % and the 10-scale", () => {
    wrap("ja", <RangeBandChart asset="BTC" band={band} history={history} />);
    const svg = screen.getByTestId("range-band-svg");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.querySelector("title")?.textContent).toContain("BTC");
    expect(svg.querySelector("desc")?.textContent).toContain("%");
    const l7 = screen.getByTestId("legend-b7").textContent!;
    expect(l7).toContain("7 日の幅");
    expect(l7).toContain("±7.5%");
    expect(l7).toContain("27%");
    expect(l7).toContain("10 回に 3 回");
    const l30 = screen.getByTestId("legend-b30").textContent!;
    expect(l30).toContain("30 日の幅");
    expect(l30).toContain("±18.6%");
    expect(screen.getByTestId("range-band-updown").textContent).toContain("上と下に分けると");
    expect(svg.innerHTML).not.toMatch(/red|green|#[0-9a-f]{3,6}/i);
  });

  it("renders nothing without a band", () => {
    const { container } = wrap("ja", <RangeBandChart asset="BTC" band={null} history={history} />);
    expect(container.textContent).toBe("");
  });
});

describe("TurnCards", () => {
  const props = { asset: "BTC" as const, forecast: s.forecast.BTC, ladder: s.ladder.BTC, turnRate: s.turn_rate.BTC, band };

  it("shows exactly the 30-day and 7-day cards and no 90-day text", () => {
    const { container } = wrap("ja", <TurnCards {...props} />);
    expect(screen.getByTestId("turn-card-30")).toBeTruthy();
    expect(screen.getByTestId("turn-card-7")).toBeTruthy();
    expect(container.querySelectorAll("article")).toHaveLength(2);
    expect(container.textContent).not.toMatch(/90/);
    const c30 = screen.getByTestId("turn-card-30");
    expect(c30.textContent).toContain("10 回に 3 回（30%）");
    expect(c30.textContent).toContain("10 回に 5 回（48%）");
    expect(c30.textContent).toContain("18.6%");
    expect(c30.querySelectorAll("i")).toHaveLength(20);
    const c7 = screen.getByTestId("turn-card-7");
    expect(within(c7).getByText(/日下げています/)).toBeTruthy();
  });

  it("renders nothing without a forecast", () => {
    const { container } = wrap("ja", <TurnCards asset="BTC" />);
    expect(container.textContent).toBe("");
  });
});

describe("static boxes", () => {
  it("WorkedExample and WhatItDoesNotTell render only with a band", () => {
    const a = wrap("ja", <><WorkedExample asset="BTC" band={null} /><WhatItDoesNotTell band={null} /></>);
    expect(a.container.textContent).toBe("");
    cleanup();
    wrap("ja", <><WorkedExample asset="BTC" band={band} /><WhatItDoesNotTell band={band} /></>);
    expect(screen.getByTestId("worked-example").hasAttribute("open")).toBe(true);
    expect(screen.getByTestId("does-not-tell").hasAttribute("open")).toBe(true);
  });
});

describe("banned words", () => {
  for (const locale of ["ja", "en"] as const) {
    for (const [name, regime] of [["BTC", btc], ["ETH", eth]] as const) {
      it(`${locale} ${name}: none of the new components use a banned word`, () => {
        const { container } = wrap(
          locale,
          <>
            <RegimeHeadline asset={name} regime={regime} />
            <RangeBandChart asset={name} band={s.range_band[name]} history={history} />
            <WhatIsThis />
            <WorkedExample asset={name} band={s.range_band[name]} />
            <WhatItDoesNotTell band={s.range_band[name]} />
            <TurnCards
              asset={name}
              forecast={s.forecast[name] ?? s.forecast.BTC}
              ladder={s.ladder[name] ?? s.ladder.BTC}
              turnRate={s.turn_rate[name]}
              band={s.range_band[name]}
            />
          </>,
        );
        expect(container.textContent!.length).toBeGreaterThan(800);
        expectClean(container.textContent!);
        for (const chip of ["long", "mid", "near"]) {
          fireEvent.click(screen.getByTestId(`regime-chip-${chip}`));
          expectClean(container.textContent!);
        }
      });
    }
  }
});
