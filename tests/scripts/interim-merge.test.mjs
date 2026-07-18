import { describe, expect, it } from "vitest";

import {
  mergeManifestText,
  splitInterimDelta,
} from "../../scripts/migrate-articles/interim-merge.mjs";

const WINDOW_START = "2026-07-11T07:55:52+09:00";
const CUTOFF = "2026-07-18T23:59:59+09:00";

const record = (postId, publishedAtJst, extra = {}) => ({
  postId,
  publishedAtJst,
  family: "signal",
  include: true,
  audit: { rawPostId: postId },
  ...extra,
});

describe("splitInterimDelta", () => {
  it("keeps only in-window records that are not already adjudicated", () => {
    const auditRecords = [
      record("OLD_IN_V1", "2026-07-10T08:01:00+09:00"),
      record("BOUNDARY_EXCLUDED", "2026-07-11T07:55:00+09:00"),
      record("IN_WINDOW_A", "2026-07-11T09:44:00+09:00"),
      record("IN_WINDOW_B", "2026-07-18T10:11:00+09:00"),
      record("AFTER_CUTOFF", "2026-07-19T07:00:00+09:00"),
    ];
    const { delta, outOfWindow, existing } = splitInterimDelta(
      auditRecords,
      new Set(["OLD_IN_V1"]),
      WINDOW_START,
      CUTOFF,
    );
    expect(delta.map((r) => r.postId)).toEqual([
      "IN_WINDOW_A",
      "IN_WINDOW_B",
    ]);
    expect(outOfWindow.map((r) => r.postId)).toEqual([
      "BOUNDARY_EXCLUDED",
      "AFTER_CUTOFF",
    ]);
    expect(existing.map((r) => r.postId)).toEqual(["OLD_IN_V1"]);
  });

  it("keeps in-window exclude records (they are part of the window ledger)", () => {
    const { delta } = splitInterimDelta(
      [
        record("IN_WINDOW_EXC", "2026-07-13T13:00:00+09:00", {
          include: false,
          excludeReason: "no publish evidence",
        }),
      ],
      new Set(),
      WINDOW_START,
      CUTOFF,
    );
    expect(delta).toHaveLength(1);
    expect(delta[0].include).toBe(false);
  });

  it("sorts the delta by publishedAtJst then postId and strips the audit field on merge", () => {
    const { delta } = splitInterimDelta(
      [
        record("B", "2026-07-14T09:00:00+09:00"),
        record("A", "2026-07-12T09:00:00+09:00"),
      ],
      new Set(),
      WINDOW_START,
      CUTOFF,
    );
    expect(delta.map((r) => r.postId)).toEqual(["A", "B"]);

    const base = [{ postId: "OLD", publishedAtJst: "2026-07-01T00:00:00+09:00" }];
    const baseText = `${JSON.stringify(base, null, 2)}\n`;
    const merged = mergeManifestText(baseText, delta);
    const parsed = JSON.parse(merged);
    expect(parsed).toHaveLength(3);
    expect(parsed[1].audit).toBeUndefined();
    expect(parsed[1].postId).toBe("A");
  });

  it("byte-preserves the existing manifest prefix on merge", () => {
    const base = [
      { postId: "OLD_1", value: 1 },
      { postId: "OLD_2", value: 2 },
    ];
    const baseText = `${JSON.stringify(base, null, 2)}\n`;
    const merged = mergeManifestText(baseText, [
      record("NEW", "2026-07-12T09:00:00+09:00"),
    ]);
    const prefix = baseText.slice(0, baseText.lastIndexOf("\n]"));
    expect(merged.startsWith(`${prefix},`)).toBe(true);
    expect(merged.endsWith("\n]\n")).toBe(true);
  });

  it("refuses to merge a delta postId that already exists in the base", () => {
    const base = [{ postId: "DUP" }];
    const baseText = `${JSON.stringify(base, null, 2)}\n`;
    expect(() =>
      mergeManifestText(baseText, [record("DUP", "2026-07-12T09:00:00+09:00")]),
    ).toThrow(/already exists/);
  });
});
