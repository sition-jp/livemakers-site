/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";
import { IntentDetailStatusBanner } from "@/components/terminal/IntentDetailStatusBanner";

function renderBanner(props: {
  status:
    | "proposed"
    | "approved"
    | "active"
    | "paused"
    | "cancelled"
    | "completed"
    | "expired"
    | "archived";
  locale: "en" | "ja";
}) {
  const messages = props.locale === "ja" ? jaMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={props.locale} messages={messages as any}>
      <IntentDetailStatusBanner status={props.status} />
    </NextIntlClientProvider>,
  );
}

describe("IntentDetailStatusBanner", () => {
  it("SB-1: returns null for status='approved' (no banner)", () => {
    const { container } = renderBanner({ status: "approved", locale: "en" });
    expect(container.textContent).toBe("");
  });

  it("SB-2: returns null for status='active' (no banner)", () => {
    const { container } = renderBanner({ status: "active", locale: "en" });
    expect(container.textContent).toBe("");
  });

  it("SB-3: renders archived message (EN)", () => {
    renderBanner({ status: "archived", locale: "en" });
    expect(
      screen.getByText(/This TradeIntent has been archived/),
    ).toBeDefined();
  });

  it("SB-4: renders expired message (JA)", () => {
    renderBanner({ status: "expired", locale: "ja" });
    expect(
      screen.getByText(/有効期限切れ/),
    ).toBeDefined();
  });

  it("SB-5: renders cancelled message", () => {
    renderBanner({ status: "cancelled", locale: "en" });
    expect(
      screen.getByText(/cancelled/i),
    ).toBeDefined();
  });
});
