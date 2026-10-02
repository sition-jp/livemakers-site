/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { SearchBar } from "@/components/search/SearchBar";
import ja from "@/messages/ja.json";

function renderBar(onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <SearchBar onClose={onClose} />
    </NextIntlClientProvider>,
  );
  return onClose;
}

describe("SearchBar (2026-10-02 spec)", () => {
  it("is a GET form to the locale search page with a focused q input", () => {
    renderBar();
    const form = screen.getByRole("search");
    expect(form.getAttribute("action")).toBe("/ja/search");
    expect(form.getAttribute("method")).toBe("get");
    const input = screen.getByRole("searchbox");
    expect(input.getAttribute("name")).toBe("q");
    expect(document.activeElement).toBe(input);
  });

  it("closes on Escape and on the close button", () => {
    const onClose = renderBar();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "検索を閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
