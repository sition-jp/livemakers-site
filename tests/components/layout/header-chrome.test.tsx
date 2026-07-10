/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { NextIntlClientProvider } from "next-intl";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getSnapshotChromeMeta } from "@/lib/home/market-snapshot";
import {
  collectScannableText,
  findLiveTokenViolations,
} from "@/lib/home/reader-grammar";
import { isAllowedChromeRoute } from "@/lib/livemakers-terminal-preview/public-topology";
import ja from "@/messages/ja.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ja",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

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
}));

function renderChrome() {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      <Header chromeMeta={getSnapshotChromeMeta()} />
      <Footer />
    </NextIntlClientProvider>,
  );
}

describe("G41 page chrome", () => {
  it("links only to chrome-ledger routes and renders no LIVE indicator", () => {
    const { container } = renderChrome();
    for (const anchor of container.querySelectorAll(
      "header a[href], footer a[href]",
    )) {
      const href =
        anchor.getAttribute("href")!.replace(/^\/ja(?=\/|$)/, "") || "/";
      expect(isAllowedChromeRoute(href), href).toBe(true);
    }
    expect(
      findLiveTokenViolations(collectScannableText(container)),
    ).toEqual([]);
    expect(screen.getByText(/SNAPSHOT/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "LIVEMAKERS" })).toBeInTheDocument();
  });

  it("reads the snapshot chip time from the fixture contract", () => {
    const meta = getSnapshotChromeMeta();
    renderChrome();
    expect(
      screen.getByText(new RegExp(`SNAPSHOT ${meta.asOfLabel}`)),
    ).toBeInTheDocument();
  });

  it("keeps the Japanese navigation labels internally consistent", () => {
    const { container } = renderChrome();
    expect(
      [...container.querySelectorAll("header nav a")].map(
        (anchor) => anchor.textContent,
      ),
    ).toEqual(["トップ", "ブリーフ", "記事", "アーカイブ", "About"]);
  });

  it("passes server-loaded chrome metadata through layout and SiteChrome", () => {
    const layout = fs.readFileSync(
      path.join(process.cwd(), "app/[locale]/layout.tsx"),
      "utf8",
    );
    const siteChrome = fs.readFileSync(
      path.join(process.cwd(), "components/layout/SiteChrome.tsx"),
      "utf8",
    );
    expect(layout).toContain("getSnapshotChromeMeta()");
    expect(layout).toContain("<SiteChrome chromeMeta={chromeMeta}>");
    expect(siteChrome).toContain("<Header chromeMeta={chromeMeta} />");
  });
});
