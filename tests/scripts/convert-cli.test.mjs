import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("convert CLI", () => {
  it("fails closed with usage when required arguments are absent", () => {
    expect(() =>
      execFileSync("node", ["scripts/migrate-articles/convert.mjs"], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      }),
    ).toThrow(/usage: convert\.mjs/);
  });
});
