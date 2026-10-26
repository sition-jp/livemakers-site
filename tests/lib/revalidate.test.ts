import { describe, expect, it } from "vitest";

import { decideCronRefresh, decideRevalidate } from "@/lib/revalidate";

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
