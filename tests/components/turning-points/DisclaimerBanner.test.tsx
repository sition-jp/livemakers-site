/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import { DisclaimerBanner } from "@/components/turning-points/DisclaimerBanner";

function withIntl(node: React.ReactNode, locale: "en" | "ja") {
  const messages = locale === "en" ? en : ja;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {node}
    </NextIntlClientProvider>
  );
}

describe("DisclaimerBanner", () => {
  it("renders 'Not financial advice' label in EN", () => {
    render(withIntl(<DisclaimerBanner />, "en"));
    const note = screen.getByTestId("disclaimer");
    expect(note).toHaveAttribute("role", "note");
    expect(note.textContent ?? "").toMatch(/financial advice/i);
  });

  it("renders JA disclaimer when locale=ja", () => {
    render(withIntl(<DisclaimerBanner />, "ja"));
    const note = screen.getByTestId("disclaimer");
    // Japanese label/body should not include the literal "financial advice"
    // EN string; assert that the JA copy is present.
    expect(note.textContent ?? "").toMatch(/投資/);
  });
});
