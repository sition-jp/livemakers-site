import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = path.join(process.cwd(), "app/[locale]/page.tsx");

describe("overview page reader terminal wiring", () => {
  it("places ReaderIntelligenceTerminal after SiteTagline with the briefs framing retired (G39-A2)", () => {
    const source = fs.readFileSync(pagePath, "utf-8");

    expect(source).toContain("@/components/terminal/ReaderIntelligenceTerminal");
    expect(source).toContain(
      "@/lib/livemakers-terminal-preview/reader-terminal-source",
    );
    expect(source).toContain("getReviewedReaderTerminalSource");
    expect(source).toContain("readerTerminalSource.data");
    expect(source).toContain("sourceProvenance={readerTerminalSource.provenance}");
    expect(source).toContain('readerTerminalT("sessionVisibilityTitle")');
    expect(source).toContain('readerTerminalT("sessionVisibilityAsOf")');
    expect(source).toContain('readerTerminalT("sessionVisibilityPacket")');
    expect(source).toContain('readerTerminalT("sourceStatusTitle")');
    expect(source).not.toContain(
      "@/lib/livemakers-terminal-preview/adapter-fixture-data",
    );
    expect(source).not.toContain("terminalPreviewAdapterFixtureMock");
    expect(source).toContain("getTranslations");

    const siteTaglineIndex = source.indexOf("<SiteTagline />");
    const readerTerminalIndex = source.indexOf("<ReaderIntelligenceTerminal");

    expect(siteTaglineIndex).toBeGreaterThan(-1);
    expect(readerTerminalIndex).toBeGreaterThan(siteTaglineIndex);

    // Doctrine §2/§5: the Cardano/Midnight WEEKLY BRIEFS framing is retired
    // from the homepage — the terminal is the page.
    expect(source).not.toContain("<EditorialHero");
    expect(source).not.toContain("<NetworkPulse");
    expect(source).not.toContain("<FourPanelStatus");
    expect(source).not.toContain("<RecentBriefs");
  });

  it("does not connect the overview terminal to live or internal sources", () => {
    const source = fs.readFileSync(pagePath, "utf-8");

    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("useSWR");
    expect(source).not.toContain("/api/");
    expect(source).not.toContain("grok");
    expect(source).not.toContain("browser");
    expect(source).not.toContain("playwright");
    expect(source).not.toContain("site_publish_log");
    expect(source).not.toContain("article_queue");
    expect(source).not.toContain('href="/terminal-preview"');
    expect(source).not.toContain('"/terminal-preview"');
    expect(source).not.toContain("'/terminal-preview'");
  });
});
