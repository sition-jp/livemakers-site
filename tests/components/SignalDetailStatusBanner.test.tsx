/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { SignalDetailStatusBanner } from "@/components/terminal/SignalDetailStatusBanner";
import type { Signal } from "@/lib/signals";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function sig(status: Signal["status"]): Signal {
  return {
    id: "sig_banner",
    event_key: "e",
    status,
    confidence: 0.7,
    pillar: "x",
    direction: "positive",
    created_at: "2026-04-19T10:00:00+00:00",
    updated_at: "2026-04-19T10:00:00+00:00",
    headline_en: "",
    headline_ja: "",
    summary_en: "",
    summary_ja: "",
  } as Signal;
}

describe("SignalDetailStatusBanner (spec §5.8 v0.2 F7)", () => {
  it("renders nothing when status is active", () => {
    const { container } = wrap(
      <SignalDetailStatusBanner signal={sig("active")} locale="en" latestId={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders superseded text WITH view_latest CTA link when latestId provided", () => {
    wrap(
      <SignalDetailStatusBanner
        signal={sig("superseded")}
        locale="en"
        latestId="sig_newer"
      />,
    );
    expect(screen.getByText(/superseded/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view latest/i });
    expect(link.getAttribute("href")).toContain("/signals/sig_newer");
  });

  it("renders superseded text WITHOUT CTA when latestId is null", () => {
    wrap(
      <SignalDetailStatusBanner
        signal={sig("superseded")}
        locale="en"
        latestId={null}
      />,
    );
    expect(screen.getByText(/superseded/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view latest/i })).toBeNull();
  });
});
