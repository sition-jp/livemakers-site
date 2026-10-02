/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Header } from "@/components/layout/Header";
import ja from "@/messages/ja.json";

vi.mock("next/navigation", () => ({ usePathname: () => "/ja" }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/",
}));

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header futureAtlasNav={false} />
    </NextIntlClientProvider>,
  );
}

describe("header search (2026-10-02 spec)", () => {
  it("has one search button outside the primary nav, closed by default", () => {
    const { container } = renderHeader();
    const button = screen.getByRole("button", { name: "検索" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector('nav[aria-label="primary"]')!.contains(button),
    ).toBe(false);
    expect(screen.queryByRole("search")).toBeNull();
  });

  it("opens the bar on click and closes the mobile menu", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "メニュー" }));
    expect(document.getElementById("mobile-menu")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    expect(screen.getByRole("search")).toBeTruthy();
    expect(document.getElementById("mobile-menu")).toBeNull();
    // 開くと送信ボタン「検索」も出るので、🔍 は aria-expanded で区別する
    expect(
      screen.getByRole("button", { name: "検索", expanded: true }),
    ).toBeTruthy();
  });

  it("opens with '/' but not while typing in a field", () => {
    renderHeader();
    const field = document.createElement("input");
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: "/" });
    expect(screen.queryByRole("search")).toBeNull();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("search")).toBeTruthy();
    field.remove();
  });
});
