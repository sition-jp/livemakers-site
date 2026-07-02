import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = path.join(process.cwd(), "app/[locale]/page.tsx");

describe("overview page reader terminal wiring", () => {
  it("places ReaderIntelligenceTerminal after SiteTagline and before EditorialHero", () => {
    const source = fs.readFileSync(pagePath, "utf-8");

    expect(source).toContain("@/components/terminal/ReaderIntelligenceTerminal");
    expect(source).toContain(
      "@/lib/livemakers-terminal-preview/reader-terminal-source",
    );
    expect(source).toContain("getReviewedReaderTerminalSource");
    expect(source).toContain("readerTerminalSource.data");
    expect(source).not.toContain(
      "@/lib/livemakers-terminal-preview/adapter-fixture-data",
    );
    expect(source).not.toContain("terminalPreviewAdapterFixtureMock");
    expect(source).toContain("getTranslations");

    const siteTaglineIndex = source.indexOf("<SiteTagline />");
    const readerTerminalIndex = source.indexOf("<ReaderIntelligenceTerminal");
    const editorialHeroIndex = source.indexOf("<EditorialHero");

    expect(siteTaglineIndex).toBeGreaterThan(-1);
    expect(readerTerminalIndex).toBeGreaterThan(siteTaglineIndex);
    expect(editorialHeroIndex).toBeGreaterThan(readerTerminalIndex);
  });

  it("does not connect the overview terminal to live or internal sources", () => {
    const source = fs.readFileSync(pagePath, "utf-8");

    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("useSWR");
    expect(source).not.toContain("/api/");
    expect(source).not.toContain("site_publish_log");
    expect(source).not.toContain("article_queue");
    expect(source).not.toContain('"/terminal-preview"');
    expect(source).not.toContain("'/terminal-preview'");
  });
});
