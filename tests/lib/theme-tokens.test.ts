import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = fs.readFileSync(
  path.join(process.cwd(), "app", "globals.css"),
  "utf8",
);

describe("B+ palette tokens (G39 layer preserved)", () => {
  it("adds lane and radar tokens in both themes", () => {
    for (const token of [
      "--lmk-lane-macro",
      "--lmk-lane-crypto",
      "--lmk-lane-rwa",
      "--lmk-radar-bg",
      "--lmk-radar-line",
      "--lmk-radar-ink",
    ]) {
      expect(css.split(`${token}:`)).toHaveLength(3);
    }
  });

  it("carries the locked logo color through the existing token mechanism", () => {
    expect(css).toContain("--lmk-logo-color");
    expect(css).toContain("--color-logo");
    expect(css).toMatch(/--lmk-logo-color:\s*#0A4F44/i);
  });

  it("keeps the light ground cool-neutral", () => {
    expect(css).toMatch(/#F7F8F6/i);
    expect(css).toMatch(/#0E6B5C/i);
    expect(css).toMatch(/#F3F6F4/i);
  });
});
