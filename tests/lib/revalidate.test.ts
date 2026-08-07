import { describe, expect, it } from "vitest";

import { decideRevalidate } from "@/lib/revalidate";

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

  it.each([
    ["empty paths", { paths: [] }],
    ["not an array", { paths: "/ja" }],
    ["no payload", null],
    ["path traversal", { paths: ["/ja/../api"] }],
    ["non-article route", { paths: ["/api/revalidate"] }],
    ["absolute url", { paths: ["https://livemakers.com/ja"] }],
  ])("rejects %s with 400", (_label, payload) => {
    expect(decideRevalidate(TOKEN, AUTH, payload)).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});
