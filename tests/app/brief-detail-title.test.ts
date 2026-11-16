import { describe, expect, it } from "vitest";

import { metadata as rootMetadata } from "@/app/layout";
import { generateMetadata } from "@/app/[locale]/brief/[slug]/page";
import { getBriefBySlug } from "@/lib/briefs";

/**
 * Weekly Brief の <title> にサイト名が二重に付く不具合 (2026-11-16 設計 §5)。
 * root layout の template が「 | LiveMakers」を付けるので、ページ側の
 * <title> 用の題には「 — LiveMakers Weekly Brief」を付けない。og はそのまま。
 */
const SLUG = "2026-W30-brief";

function renderedTitle(pageTitle: unknown): string {
  const template = (rootMetadata.title as { template: string }).template;
  expect(typeof pageTitle).toBe("string");
  return template.replace("%s", pageTitle as string);
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("Weekly Brief detail <title>", () => {
  it.each(["ja", "en"] as const)("names LiveMakers exactly once (%s)", async (locale) => {
    const meta = await generateMetadata({
      params: Promise.resolve({ locale, slug: SLUG }),
    });
    const title = renderedTitle(meta.title);
    expect(countOf(title, "LiveMakers")).toBe(1);
    expect(title.endsWith(" | LiveMakers")).toBe(true);
  });

  it("keeps the og / twitter title as the brief's own title", async () => {
    const brief = getBriefBySlug(SLUG)!;
    const meta = await generateMetadata({
      params: Promise.resolve({ locale: "ja", slug: SLUG }),
    });
    expect(meta.title).toBe(brief.metadata.title_ja);
    expect(meta.openGraph?.title).toBe(brief.metadata.title_ja);
    expect((meta.twitter as { title?: string } | undefined)?.title).toBe(
      brief.metadata.title_ja,
    );
  });
});
