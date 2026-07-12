import fs from "node:fs";

import { describe, expect, it } from "vitest";

const src = fs.readFileSync("app/[locale]/sessions/[slug]/page.tsx", "utf8");

describe("session detail page", () => {
  it("wires intraday day nav via getDaySessionNav", () => {
    expect(src).toContain("getDaySessionNav");
    expect(src).toContain("nav.prev");
    expect(src).toContain("nav.next");
  });
});
