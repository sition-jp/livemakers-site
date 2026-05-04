/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import { UnavailableNotice } from "@/components/turning-points/UnavailableNotice";

function withIntl(node: React.ReactNode, locale: "en" | "ja" = "en") {
  const messages = locale === "en" ? en : ja;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {node}
    </NextIntlClientProvider>
  );
}

describe("UnavailableNotice", () => {
  it("renders role=alert with localized title and body (EN)", () => {
    render(withIntl(<UnavailableNotice reason="schema: 3 issue(s)" />));
    const alert = screen.getByRole("alert");
    expect(alert.textContent ?? "").toMatch(/temporarily unavailable/i);
    expect(alert.textContent ?? "").toMatch(/schema validation/i);
  });

  it("renders the parseError reason verbatim when provided", () => {
    render(withIntl(<UnavailableNotice reason="JSON.parse: bad token" />));
    expect(
      screen.getByTestId("turning-points-unavailable-reason"),
    ).toHaveTextContent("JSON.parse: bad token");
  });

  it("hides the reason line when null", () => {
    render(withIntl(<UnavailableNotice reason={null} />));
    expect(
      screen.queryByTestId("turning-points-unavailable-reason"),
    ).toBeNull();
  });

  it("supports a custom testid (used to disambiguate radar/detail/backtest)", () => {
    render(
      withIntl(
        <UnavailableNotice reason="x" testid="backtest-unavailable" />,
      ),
    );
    expect(screen.getByTestId("backtest-unavailable")).toBeInTheDocument();
    expect(
      screen.getByTestId("backtest-unavailable-reason"),
    ).toBeInTheDocument();
  });

  it("renders Japanese copy when locale=ja", () => {
    render(
      withIntl(<UnavailableNotice reason="schema: 1 issue(s)" />, "ja"),
    );
    expect(screen.getByRole("alert").textContent ?? "").toMatch(
      /取得できません/,
    );
  });
});
