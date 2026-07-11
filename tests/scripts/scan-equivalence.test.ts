import { describe, expect, it } from "vitest";

import forbidden from "../../scripts/migrate-articles/forbidden-terms.json";
import { scanForbidden } from "../../scripts/migrate-articles/scan.mjs";
import {
  ALLOWED_PUBLIC_LABELS,
  FORBIDDEN_DESIGN_TERMS,
  FORBIDDEN_OPS_TERMS,
  matchesTerm,
} from "@/lib/home/reader-grammar";

describe("forbidden registry / scanner equivalence", () => {
  it("matches the site design/label sets and partitions the ops set", () => {
    expect(new Set(forbidden.designTerms)).toEqual(
      new Set(FORBIDDEN_DESIGN_TERMS),
    );
    expect(new Set(forbidden.allowedPublicLabels)).toEqual(
      new Set(ALLOWED_PUBLIC_LABELS),
    );
    expect(
      new Set([...forbidden.opsTerms, ...forbidden.bodyExemptTerms]),
    ).toEqual(new Set(FORBIDDEN_OPS_TERMS));
    expect(
      forbidden.opsTerms.filter((term) =>
        forbidden.bodyExemptTerms.includes(term),
      ),
    ).toEqual([]);
    expect(forbidden.bodyExemptTerms).toEqual(["https://", "http://"]);
  });

  const directCases: Array<[string, string[]]> = [
    ["本文に crawler が残る", ["crawler"]],
    ["本文に Crawler が残る", ["crawler"]],
    ["many crawlers here", []],
    ["Phase 1 のログ", ["phase 1"]],
    ["SDE検出 のラベルは許可", []],
    ["SDE出力 は禁止", ["SDE出力"]],
    ["co-equal と CO-EQUAL", ["co-equal", "CO-EQUAL"]],
    ["一次ソース https://x.com/SITIONjp/status/1 を参照", []],
    ["published_log を参照", ["published_log"]],
    ["参照 file:///tmp/x.md", ["file://"]],
    ["/Users/ 配下のパス", ["/Users/"]],
    ["/Users/sition/private.md を参照", ["/Users/"]],
    ["07_DATA/content の位置", ["07_DATA"]],
    ["無関係の安全な本文です", []],
  ];

  it("returns exactly the expected hits", () => {
    for (const [input, expected] of directCases) {
      expect(new Set(scanForbidden(input)), input).toEqual(new Set(expected));
    }
    expect(scanForbidden("/Users/sition/private.md")).toContain("/Users/");
  });

  it("matches site semantics for terms whose ends are alphanumeric", () => {
    const alnumEdged = forbidden.opsTerms.filter(
      (term) => /^[a-z0-9]/i.test(term) && /[a-z0-9]$/i.test(term),
    );
    for (const [input] of directCases) {
      const lower = input.toLowerCase();
      for (const term of alnumEdged) {
        expect(
          scanForbidden(input).includes(term),
          `${term} in ${input}`,
        ).toBe(matchesTerm(lower, term.toLowerCase()));
      }
    }
  });

  it("is intentionally stricter for non-alphanumeric term edges", () => {
    expect(matchesTerm("/users/sition", "/users/")).toBe(false);
    expect(scanForbidden("/Users/sition")).toContain("/Users/");
  });
});
