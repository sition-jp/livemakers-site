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
    // "cloudflare" は 2026-08-07 に opsTerms から移設。union (= FORBIDDEN_OPS_TERMS)
    // は不変なので terminal 面の遮断は維持され、記事本文だけが免除される。
    expect(forbidden.bodyExemptTerms).toEqual([
      "https://",
      "http://",
      "cloudflare",
    ]);
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
    // 2026-08-07: Cloudflare は報道対象の企業名として記事本文に正当に出る。
    // terminal 面 (FORBIDDEN_OPS_TERMS) では内部運用語として遮断を維持しつつ、
    // 本文スキャンからは外す = bodyExemptTerms 行き。
    ["Cloudflareがエージェント向けブラウザKitesurfをWorkers上で公開した", []],
    ["Cloudflare網の通信の半分が非人間になった", []],
    // 免除しても「取得手段の失敗を語る」本来の leak は他の ops 語で捕捉が続く
    [
      "Truth Social は Cloudflare の SPA shell を返し chrome mcp 経由では取得できない",
      ["chrome mcp"],
    ],
    ["Cloudflare 由来の fallback が partial_success で止まった", ["fallback", "partial_success"]],
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
