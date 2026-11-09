import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { metadata } from "@/app/layout";
import { HOME_OG_IMAGE_PATH } from "@/lib/site";

describe("root metadata (home OG / X card)", () => {
  it("declares a home og:image so link cards render with an image", () => {
    const og = metadata.openGraph as { images?: unknown };
    expect(Array.isArray(og.images)).toBe(true);
    const first = (og.images as Array<{ url: string; width: number; height: number }>)[0];
    expect(first.url).toBe("/og-home-horizon.jpg");
    expect(first.width).toBe(1200);
    expect(first.height).toBe(630);
  });

  it("uses a large-image X card that points at the same image", () => {
    const tw = metadata.twitter as { card?: string; images?: string[] };
    expect(tw.card).toBe("summary_large_image");
    expect(tw.images).toEqual(["/og-home-horizon.jpg"]);
  });

  it("points at an image file that exists in public/", () => {
    expect(existsSync(path.join(process.cwd(), "public", HOME_OG_IMAGE_PATH))).toBe(true);
  });
});
