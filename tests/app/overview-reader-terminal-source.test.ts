import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = path.join(process.cwd(), "app/[locale]/page.tsx");

describe("overview page B+ composition wiring", () => {
  it("composes the fixture-only home props, ticker, provenance, and B+ groups", () => {
    const source = fs.readFileSync(pagePath, "utf-8");

    expect(source).toContain("@/components/home/HomeComposition");
    expect(source).toContain("@/components/home/GlobalProvenanceStrip");
    expect(source).toContain("@/lib/home/build-home-props");
    expect(source).toContain("buildHomeCompositionProps");
    expect(source).toContain("<TickerBar");
    expect(source).toContain("<GlobalProvenanceStrip");
    expect(source).toContain("<HomeComposition");
    expect(source).not.toContain(
      "@/lib/livemakers-terminal-preview/adapter-fixture-data",
    );
    expect(source).not.toContain("terminalPreviewAdapterFixtureMock");
    expect(source).toContain("getTranslations");
    expect(source).not.toContain("ReaderIntelligenceTerminal");
    expect(source).not.toContain("fetchLiveMarketData");
    expect(source).not.toContain("<EditorialHero");
    expect(source).not.toContain("<NetworkPulse");
    expect(source).not.toContain("<FourPanelStatus");
    expect(source).not.toContain("<RecentBriefs");
  });

  it("does not connect the overview to live, internal, or preview sources", () => {
    const source = fs.readFileSync(pagePath, "utf-8");

    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("useSWR");
    expect(source).not.toContain("/api/");
    expect(source).not.toContain("grok");
    expect(source).not.toContain("browser");
    expect(source).not.toContain("playwright");
    expect(source).not.toContain("site_publish_log");
    expect(source).not.toContain("article_queue");
    expect(source).not.toContain("adapter-fixture-data");
    expect(source).not.toContain('href="/terminal-preview"');
    expect(source).not.toContain('"/terminal-preview"');
    expect(source).not.toContain("'/terminal-preview'");
  });
});
