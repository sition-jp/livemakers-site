import { describe, expect, it } from "vitest";

import {
  articleSlugsFromPaths,
  decideCronRefresh,
  decideRevalidate,
  pagePathTag,
} from "@/lib/revalidate";

const TOKEN = "test-revalidate-token";
const AUTH = `Bearer ${TOKEN}`;

describe("on-demand revalidation decision (GO#2 追補・GO#3 まで inert)", () => {
  it("is fully inert (404) while the token env is not provisioned", () => {
    const decision = decideRevalidate(undefined, AUTH, {
      paths: ["/ja/articles/x"],
    });
    expect(decision).toEqual({
      ok: false,
      status: 404,
      reason: "route_disabled",
    });
  });

  it("rejects a missing or wrong bearer token with 401", () => {
    expect(decideRevalidate(TOKEN, null, { paths: ["/ja"] })).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(
      decideRevalidate(TOKEN, "Bearer wrong", { paths: ["/ja"] }),
    ).toMatchObject({ ok: false, status: 401 });
  });

  it("accepts only article-surface paths and dedupes", () => {
    const decision = decideRevalidate(TOKEN, AUTH, {
      paths: [
        "/ja",
        "/ja/articles",
        "/ja/articles/signal-20260807-abc12345",
        "/en/articles/series/signal",
        "/ja/articles/signal-20260807-abc12345",
      ],
    });
    expect(decision).toEqual({
      ok: true,
      paths: [
        "/ja",
        "/ja/articles",
        "/ja/articles/signal-20260807-abc12345",
        "/en/articles/series/signal",
      ],
    });
  });

  it("accepts session surfaces (archive + detail) — Phase 1, 2026-08-14", () => {
    const decision = decideRevalidate(TOKEN, AUTH, {
      paths: [
        "/ja/sessions",
        "/ja/sessions/archive",
        "/ja/sessions/2026-08-07-asia-open",
        "/en/sessions/archive",
      ],
    });
    expect(decision).toEqual({
      ok: true,
      paths: [
        "/ja/sessions",
        "/ja/sessions/archive",
        "/ja/sessions/2026-08-07-asia-open",
        "/en/sessions/archive",
      ],
    });
  });

  it.each([
    ["empty paths", { paths: [] }],
    ["not an array", { paths: "/ja" }],
    ["no payload", null],
    ["path traversal", { paths: ["/ja/../api"] }],
    ["non-article route", { paths: ["/api/revalidate"] }],
    ["absolute url", { paths: ["https://livemakers.com/ja"] }],
    ["sessions traversal", { paths: ["/ja/sessions/../../api"] }],
    ["sessions uppercase", { paths: ["/ja/sessions/2026-08-07-ASIA"] }],
  ])("rejects %s with 400", (_label, payload) => {
    expect(decideRevalidate(TOKEN, AUTH, payload)).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});

describe("cron refresh backstop decision (Phase 1, 2026-08-14)", () => {
  it("is fully inert (404) while CRON_SECRET is not provisioned", () => {
    expect(decideCronRefresh(undefined, AUTH)).toEqual({
      ok: false,
      status: 404,
      reason: "route_disabled",
    });
  });

  it("rejects a missing or wrong bearer with 401", () => {
    expect(decideCronRefresh(TOKEN, null)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(decideCronRefresh(TOKEN, "Bearer wrong")).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("purges exactly the two home routes on a valid call", () => {
    expect(decideCronRefresh(TOKEN, AUTH)).toEqual({
      ok: true,
      paths: ["/ja", "/en"],
    });
  });
});

// 2026-10-26 (PR-A): 合図は「古いページを出しながら裏で作り直す」(stale-while-
// revalidate) で送る。revalidatePath はページを即時に捨てるので、作り直しが
// Blob の 403 で失敗すると前のページが残らず 500 になった (手元で再現)。
// revalidatePath が内部で使う印 (暗黙タグ) を revalidateTag(…, "max") で送る
describe("pagePathTag (the implicit tag revalidatePath would expire)", () => {
  it("matches Next.js's implicit tag prefix", async () => {
    const { NEXT_CACHE_IMPLICIT_TAG_ID } = await import("next/dist/lib/constants");
    expect(pagePathTag("/ja")).toBe(`${NEXT_CACHE_IMPLICIT_TAG_ID}/ja`);
  });

  it("drops a trailing slash like revalidatePath does", () => {
    expect(pagePathTag("/ja/articles/")).toBe("_N_T_/ja/articles");
    expect(pagePathTag("/en")).toBe("_N_T_/en");
  });

  it("is what both revalidation routes send, with the stale-while-revalidate profile", async () => {
    const fs = await import("node:fs");
    for (const file of ["app/api/revalidate/route.ts", "app/api/cron/refresh-home/route.ts"]) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).toContain('revalidateTag(pagePathTag(path), "max")');
      expect(source, file).not.toMatch(/revalidatePath\(/);
    }
  });
});

describe("articleSlugsFromPaths (段 2a)", () => {
  it("collects article slugs once, skipping series and non-article pages", () => {
    expect(
      articleSlugsFromPaths([
        "/ja",
        "/ja/articles/a-20261027-0123abcd",
        "/en/articles/a-20261027-0123abcd",
        "/ja/articles/series/signal",
        "/ja/articles/today",
        "/ja/articles",
      ]),
    ).toEqual(["a-20261027-0123abcd"]);
  });
});
