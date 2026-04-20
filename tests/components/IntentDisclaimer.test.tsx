/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import jaMessages from "@/messages/ja.json";
import { IntentDisclaimer } from "@/components/terminal/IntentDisclaimer";

function renderWithLocale(locale: "en" | "ja") {
  const messages = locale === "ja" ? jaMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages as any}>
      <IntentDisclaimer />
    </NextIntlClientProvider>,
  );
}

describe("IntentDisclaimer", () => {
  it("ID-1: renders a note landmark with the disclaimer body (EN)", () => {
    renderWithLocale("en");
    const note = screen.getByRole("note");
    expect(note).toBeDefined();
    expect(note.textContent).toContain("LiveMakers Terminal");
    expect(note.textContent).toContain("editorial investment hypotheses");
  });

  it("ID-2: renders JA disclaimer under ja locale", () => {
    renderWithLocale("ja");
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("LiveMakers Terminal");
    expect(note.textContent).toContain("編集上の投資仮説");
  });
});
