/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";
import { IntentConvictionGrid } from "@/components/terminal/IntentConvictionGrid";

function renderGrid(props: {
  thesis_conviction: number;
  execution_confidence: number;
  priority: number;
  preferred_horizon: "intraday" | "swing" | "position" | "multi-week";
  bucket: "core" | "tactical" | "experimental" | "hedge";
  locale: "en" | "ja";
}) {
  const messages = props.locale === "ja" ? jaMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={props.locale} messages={messages as any}>
      <IntentConvictionGrid {...props} />
    </NextIntlClientProvider>,
  );
}

describe("IntentConvictionGrid", () => {
  it("CG-1: renders all 4 numeric values", () => {
    renderGrid({
      thesis_conviction: 0.72,
      execution_confidence: 0.45,
      priority: 0.6,
      preferred_horizon: "swing",
      bucket: "tactical",
      locale: "en",
    });
    expect(screen.getByText("0.72")).toBeDefined();
    expect(screen.getByText("0.45")).toBeDefined();
    expect(screen.getByText("0.60")).toBeDefined();
    expect(screen.getByText("swing")).toBeDefined();
    expect(screen.getByText("tactical")).toBeDefined();
    expect(screen.getByText("Bucket")).toBeDefined();
  });

  it("CG-2: renders EN labels", () => {
    renderGrid({
      thesis_conviction: 0.5,
      execution_confidence: 0.5,
      priority: 0.5,
      preferred_horizon: "swing",
      bucket: "tactical",
      locale: "en",
    });
    expect(screen.getByText("Thesis conviction")).toBeDefined();
    expect(screen.getByText("Execution confidence")).toBeDefined();
  });

  it("CG-3: renders JA labels", () => {
    renderGrid({
      thesis_conviction: 0.5,
      execution_confidence: 0.5,
      priority: 0.5,
      preferred_horizon: "swing",
      bucket: "tactical",
      locale: "ja",
    });
    expect(screen.getByText("仮説の確信度")).toBeDefined();
    expect(screen.getByText("執行の確信度")).toBeDefined();
  });

  it("CG-4: marks warning when thesis_conviction === execution_confidence exactly", () => {
    const { container } = renderGrid({
      thesis_conviction: 0.5,
      execution_confidence: 0.5,
      priority: 0.5,
      preferred_horizon: "swing",
      bucket: "tactical",
      locale: "en",
    });
    expect(
      container.querySelector("[data-conviction-parity-warning='true']"),
    ).toBeTruthy();
  });

  it("CG-5: does NOT warn when thesis_conviction !== execution_confidence", () => {
    const { container } = renderGrid({
      thesis_conviction: 0.72,
      execution_confidence: 0.45,
      priority: 0.5,
      preferred_horizon: "swing",
      bucket: "tactical",
      locale: "en",
    });
    expect(
      container.querySelector("[data-conviction-parity-warning='true']"),
    ).toBeNull();
  });

  it("CG-6: does NOT warn when both values are 0 (pristine state)", () => {
    const { container } = renderGrid({
      thesis_conviction: 0,
      execution_confidence: 0,
      priority: 0.5,
      preferred_horizon: "swing",
      bucket: "tactical",
      locale: "en",
    });
    expect(
      container.querySelector("[data-conviction-parity-warning='true']"),
    ).toBeNull();
  });

  it("CG-7: warns when values within 0.02 epsilon (near-equal)", () => {
    const { container } = renderGrid({
      thesis_conviction: 0.5,
      execution_confidence: 0.51,
      priority: 0.5,
      preferred_horizon: "swing",
      bucket: "tactical",
      locale: "en",
    });
    expect(
      container.querySelector("[data-conviction-parity-warning='true']"),
    ).toBeTruthy();
  });
});
