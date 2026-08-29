/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { GlobalProvenanceStrip } from "@/components/home/GlobalProvenanceStrip";
import { Header } from "@/components/layout/Header";
import ja from "@/messages/ja.json";

const usePathnameMock = vi.fn<() => string>(() => "/");

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
  usePathname: () => usePathnameMock(),
}));

const chromeMeta = { dateLabel: "2026-08-23 (日)", asOfLabel: "07:30 JST" };

function renderChrome() {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header futureAtlasNav={false} />
      <GlobalProvenanceStrip
        provenance={{
          packetId: "lmk_20260823_0730_a1",
          sourceMode: "collected_live",
          reviewStatus: "auto_collected",
          asOfJst: "12:45 JST",
        }}
        labels={{
          review: "審査状態",
          source: "ソース",
          asOf: "as-of",
          packet: "パケットID",
        }}
        note="数値は取得時点のスナップショットです"
        chromeMeta={chromeMeta}
        snapshotLabel="SNAPSHOT"
      />
    </NextIntlClientProvider>,
  );
}

/**
 * 言語トグル (2026-08-21 田平氏 GO で復活 → 2026-08-23 田平氏指示で
 * ヘッダ 1 段目から 3 段目 = 来歴帯の右クラスタへ移設)。
 * localePrefix "always" + localeDetection false なので、トグルは
 * cookie 細工なしの明示 URL リンク 2 本でよい。
 */
describe("Language toggle placement", () => {
  it("links to the same page in each locale", () => {
    usePathnameMock.mockReturnValue("/articles");
    renderChrome();
    expect(screen.getByRole("link", { name: "日本語" })).toHaveAttribute(
      "href",
      "/ja/articles",
    );
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute(
      "href",
      "/en/articles",
    );
  });

  it("links to the locale roots from the home page", () => {
    usePathnameMock.mockReturnValue("/");
    renderChrome();
    expect(screen.getByRole("link", { name: "日本語" })).toHaveAttribute(
      "href",
      "/ja",
    );
    expect(screen.getByRole("link", { name: "EN" })).toHaveAttribute(
      "href",
      "/en",
    );
  });

  it("lives in the provenance strip's right cluster, before LIGHT/DARK, not in the header (2026-08-23 田平氏指示)", () => {
    usePathnameMock.mockReturnValue("/");
    const { container } = renderChrome();
    const toggle = screen.getByRole("link", { name: "日本語" });
    const strip = container.querySelector('[data-chrome="provenance-strip"]');
    expect(strip?.contains(toggle)).toBe(true);
    expect(container.querySelector("header")?.contains(toggle)).toBe(false);

    // 操作系 (言語 → テーマ) を左、表示系 (日付 → SNAPSHOT → version) を右に
    const light = screen.getByRole("button", { name: /light/i });
    expect(
      toggle.compareDocumentPosition(light) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const snapshot = screen.getByText(/SNAPSHOT 07:30 JST/);
    expect(
      light.compareDocumentPosition(snapshot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
