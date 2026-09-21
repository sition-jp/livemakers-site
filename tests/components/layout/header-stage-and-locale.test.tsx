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
 * 言語トグル (2026-08-21 田平氏 GO で復活 → 2026-08-23 来歴帯の右クラスタへ
 * 移設 → 2026-09-21 田平氏指示で非表示)。日本語版のみ稼働中のため EN への
 * 導線はヘッダにも来歴帯にも出さない。/en ルートと LanguageToggle
 * コンポーネント自体は残す (URL 契約・復活時の手間の観点)。
 */
describe("Language toggle hidden (2026-09-21 田平氏指示)", () => {
  it("renders no EN / 日本語 locale links anywhere in the chrome", () => {
    usePathnameMock.mockReturnValue("/articles");
    const { container } = renderChrome();
    expect(screen.queryByRole("link", { name: "EN" })).toBeNull();
    expect(screen.queryByRole("link", { name: "日本語" })).toBeNull();
    expect(
      [...container.querySelectorAll("a[href]")].filter((anchor) =>
        anchor.getAttribute("href")!.startsWith("/en"),
      ),
    ).toHaveLength(0);
  });

  it("keeps LIGHT/DARK → date → SNAPSHOT → version order in the strip's right cluster", () => {
    usePathnameMock.mockReturnValue("/");
    const { container } = renderChrome();
    const strip = container.querySelector('[data-chrome="provenance-strip"]');
    const light = screen.getByRole("button", { name: /light/i });
    expect(strip?.contains(light)).toBe(true);
    const snapshot = screen.getByText(/SNAPSHOT 07:30 JST/);
    expect(
      light.compareDocumentPosition(snapshot) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

/**
 * 段階バッジ (2026-09-21 田平氏指示): ALPHA → ベータ版。ロゴ横に出す。
 */
describe("Release stage badge", () => {
  it("shows ベータ版 next to the logo and no ALPHA text", () => {
    usePathnameMock.mockReturnValue("/");
    const { container } = renderChrome();
    const badge = screen.getByText("ベータ版");
    expect(container.querySelector("header")?.contains(badge)).toBe(true);
    expect(screen.queryByText("ALPHA")).toBeNull();
  });
});
