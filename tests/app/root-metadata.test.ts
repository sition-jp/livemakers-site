import { describe, expect, it } from "vitest";
import { metadata } from "@/app/layout";

describe("root metadata (home OG / X card)", () => {
  it("declares a home og:image so link cards render with an image", () => {
    const og = metadata.openGraph as { images?: unknown };
    expect(Array.isArray(og.images)).toBe(true);
    const first = (og.images as Array<{ url: string; width: number; height: number }>)[0];
    expect(first.url).toBe("/og-home.jpg");
    expect(first.width).toBe(1200);
    expect(first.height).toBe(630);
  });

  it("uses a large-image X card that points at the same image", () => {
    const tw = metadata.twitter as { card?: string; images?: string[] };
    expect(tw.card).toBe("summary_large_image");
    expect(tw.images).toEqual(["/og-home.jpg"]);
  });
});
