import { describe, expect, it } from "vitest";
import { buildSiteNativePublishedFeed } from "@/lib/terminal/published-window";
import { getAllBriefs } from "@/lib/briefs";
import { validateReaderTerminalPublicTopology } from "@/lib/livemakers-terminal-preview/public-topology";
import { readerTerminalPublicTopology } from "@/lib/livemakers-terminal-preview/public-topology";

describe("buildSiteNativePublishedFeed (B4 site-native primary)", () => {
  it("enumerates the on-disk briefs newest-first into feed items", () => {
    const feed = buildSiteNativePublishedFeed();
    const briefs = getAllBriefs();
    expect(briefs.length).toBeGreaterThan(0);
    expect(feed).not.toBeNull();

    const items = feed!.items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    // getAllBriefs is sorted newest-first; the feed preserves that order.
    expect(items[0].href).toBe(`/brief/${briefs[0].slug}`);
    expect(items[0].title.ja).toBe(briefs[0].title_ja);
    expect(items[0].family).toBe("Weekly Brief");
  });

  it("produces excerpts that are markdown-stripped and length-bounded", () => {
    const feed = buildSiteNativePublishedFeed();
    const first = feed!.items[0];
    expect(first.excerpt.en).not.toContain("**");
    expect(first.excerpt.ja).not.toContain("**");
    // truncate() bounds to code points; JA <= 90, EN <= 140 (+ ellipsis).
    expect(Array.from(first.excerpt.ja).length).toBeLessThanOrEqual(90);
    expect(Array.from(first.excerpt.en).length).toBeLessThanOrEqual(140);
  });

  it("keeps the unmodified public-topology validator green with the live feed", () => {
    const feed = buildSiteNativePublishedFeed();
    // Swap the live feed into the reviewed topology and validate: every
    // /brief/{slug} href must satisfy the allowed-route + forbidden-text rules.
    const topology = {
      ...readerTerminalPublicTopology,
      articleNewsFeed: {
        title: feed!.title,
        items: feed!.items,
      },
    };
    expect(validateReaderTerminalPublicTopology(topology)).toEqual([]);
  });
});
