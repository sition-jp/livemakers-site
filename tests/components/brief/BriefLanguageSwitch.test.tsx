/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BriefLanguageSwitch } from "@/components/brief/BriefLanguageSwitch";

/**
 * localePrefix "always" 化 (2026-08-21) で EN も /en 接頭辞必須になった。
 * cookie + window.location.assign の細工は不要になり、明示 URL の
 * リンク 2 本に簡素化されている。
 */
describe("BriefLanguageSwitch", () => {
  it("renders explicit locale-prefixed links for both languages", () => {
    render(<BriefLanguageSwitch slug="test-brief" currentLang="ja" />);
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute(
      "href",
      "/en/brief/test-brief",
    );
    expect(screen.getByRole("link", { name: "日本語" })).toHaveAttribute(
      "href",
      "/ja/brief/test-brief",
    );
  });
});
