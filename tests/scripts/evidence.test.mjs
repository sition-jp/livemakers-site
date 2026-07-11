import { describe, expect, it } from "vitest";

import {
  checkConflict,
  checkLogEvidence,
  checkPrimaryEvidence,
  hoursBetween,
  normalizeTitle,
  utcToJstIso,
} from "../../scripts/migrate-articles/evidence.mjs";

const record = {
  postId: "2026-07-10_STN_B_001",
  logUrl: "https://x.com/SITIONjp/status/100",
  sourceXUrl: "https://x.com/SITIONjp/status/100",
  publishedAtJst: "2026-07-10T05:52:00+09:00",
  logPublishedAtUtc: "2026-07-09T20:52:00+00:00",
  logTitle: "📋 Daily Intel 7/10｜停戦崩壊",
  titleOriginal: "📋 Daily Intel 7/10｜停戦崩壊",
  titleMatch: "exact",
};
const row = {
  id: "2026-07-10_STN_B_001",
  account: "SITIONjp",
  status: "published",
  url: "https://x.com/SITIONjp/status/100",
  published_at: "2026-07-09T20:52:00+00:00",
  title: "📋 Daily Intel 7/10｜停戦崩壊",
};
const index = (candidate) => new Map([[candidate.id, [candidate]]]);

describe("evidence.mjs — log_verified four conditions", () => {
  it("passes the reference row", () => {
    expect(checkLogEvidence(record, index(row), "2026-07-10")).toEqual([]);
  });

  it("fails on key, status, or account mismatch", () => {
    expect(
      checkLogEvidence(record, index({ ...row, id: "OTHER" }), "2026-07-10")[0],
    ).toMatch(/exact key/);
    expect(
      checkLogEvidence(
        record,
        index({ ...row, status: "draft" }),
        "2026-07-10",
      )[0],
    ).toMatch(/exact key/);
    expect(
      checkLogEvidence(
        record,
        index({ ...row, account: "SIPO_Tokyo" }),
        "2026-07-10",
      )[0],
    ).toMatch(/exact key/);
  });

  it("fails on URL identity or form violations", () => {
    expect(
      checkLogEvidence(
        {
          ...record,
          sourceXUrl: "https://x.com/SITIONjp/status/999",
        },
        index(row),
        "2026-07-10",
      ).join(),
    ).toMatch(/sourceXUrl/);
    expect(
      checkLogEvidence(
        record,
        index({ ...row, url: "https://x.com/other/status/100" }),
        "2026-07-10",
      ).join(),
    ).toMatch(/url form/);
  });

  it("fails on invalid ISO, JST mismatch, or the 48-hour window", () => {
    expect(
      checkLogEvidence(
        record,
        index({ ...row, published_at: "not-a-date" }),
        "2026-07-10",
      ).join(),
    ).toMatch(/valid ISO/);
    expect(
      checkLogEvidence(
        { ...record, publishedAtJst: "2026-07-10T09:00:00+09:00" },
        index(row),
        "2026-07-10",
      ).join(),
    ).toMatch(/JST/);
    expect(
      checkLogEvidence(
        record,
        index({ ...row, published_at: "2026-07-04T20:52:00+00:00" }),
        "2026-07-10",
      ).join(),
    ).toMatch(/48h|JST/);
  });

  it("fails when titleMatch disagrees with either recomputation direction", () => {
    expect(
      checkLogEvidence(
        { ...record, logTitle: "別の題" },
        index({ ...row, title: "別の題" }),
        "2026-07-10",
      ).join(),
    ).toMatch(/titleMatch/);
    expect(
      checkLogEvidence(
        { ...record, titleMatch: "manual" },
        index(row),
        "2026-07-10",
      ).join(),
    ).toMatch(/titleMatch/);
  });

  it("fails when declared provenance differs from the log row", () => {
    expect(
      checkLogEvidence(
        {
          ...record,
          logPublishedAtUtc: "2026-07-09T20:00:00+00:00",
        },
        index(row),
        "2026-07-10",
      ).join(),
    ).toMatch(/logPublishedAtUtc/);
    expect(
      checkLogEvidence(
        { ...record, logTitle: "宣言だけ違う題" },
        index(row),
        "2026-07-10",
      ).join(),
    ).toMatch(/logTitle/);
  });
});

describe("evidence.mjs — primary and conflict checks", () => {
  const frontmatter = {
    status: "published",
    publishedUrl: "https://x.com/SITIONjp/status/100",
    publishedAt: "2026-07-10T05:52:00+09:00",
    title: null,
    postId: null,
  };

  it("passes primary evidence and fails status, URL, or time drift", () => {
    expect(
      checkPrimaryEvidence(
        { ...record, primaryUrl: frontmatter.publishedUrl },
        frontmatter,
      ),
    ).toEqual([]);
    expect(
      checkPrimaryEvidence(
        { ...record, primaryUrl: frontmatter.publishedUrl },
        { ...frontmatter, status: "review_ready" },
      ).join(),
    ).toMatch(/status/);
    expect(
      checkPrimaryEvidence(
        { ...record, primaryUrl: "https://x.com/SITIONjp/status/999" },
        frontmatter,
      ).join(),
    ).toMatch(/primaryUrl/);
    expect(
      checkPrimaryEvidence(
        {
          ...record,
          primaryUrl: frontmatter.publishedUrl,
          publishedAtJst: "2026-07-10T09:00:00+09:00",
        },
        frontmatter,
      ).join(),
    ).toMatch(/published_at/);
  });

  it("fails closed when primary evidence lacks published_at", () => {
    expect(
      checkPrimaryEvidence(
        { ...record, primaryUrl: frontmatter.publishedUrl },
        { ...frontmatter, publishedAt: null },
      ).join(),
    ).toMatch(/published_at missing/);
  });

  it("detects published URL conflicts and ignores non-published rows", () => {
    expect(
      checkConflict(
        frontmatter,
        index({ ...row, url: "https://x.com/SITIONjp/status/200" }),
        record.postId,
      ).join(),
    ).toMatch(/conflict/);
    expect(checkConflict(frontmatter, index(row), record.postId)).toEqual([]);
    expect(
      checkConflict(
        frontmatter,
        index({
          ...row,
          status: "draft",
          url: "https://x.com/SITIONjp/status/200",
        }),
        record.postId,
      ),
    ).toEqual([]);
  });
});

describe("evidence.mjs — helpers", () => {
  it("converts strict ISO timestamps and rejects loose/nonexistent inputs", () => {
    expect(utcToJstIso("2026-07-09T20:52:00+00:00")).toBe(
      "2026-07-10T05:52:00+09:00",
    );
    expect(utcToJstIso("2026-07-09T20:52:00Z")).toBe(
      "2026-07-10T05:52:00+09:00",
    );
    expect(utcToJstIso("garbage")).toBeNull();
    expect(utcToJstIso("2026-07-09")).toBeNull();
    expect(utcToJstIso("Jul 9, 2026 20:52")).toBeNull();
    expect(utcToJstIso("2026-02-30T20:52:00+00:00")).toBeNull();
    expect(utcToJstIso("2026-07-09T20:52:00")).toBeNull();
  });

  it("returns Infinity for invalid hour comparisons", () => {
    expect(hoursBetween("garbage", "2026-07-10T00:00:00+09:00")).toBe(
      Infinity,
    );
  });

  it("normalizes title whitespace, emoji, and slashes exactly", () => {
    expect(normalizeTitle("📋 Daily Intel 7/10｜停戦崩壊")).toBe(
      "DailyIntel710｜停戦崩壊",
    );
    expect(normalizeTitle(" Daily  Intel 7/10｜停戦崩壊 ")).toBe(
      "DailyIntel710｜停戦崩壊",
    );
  });
});
