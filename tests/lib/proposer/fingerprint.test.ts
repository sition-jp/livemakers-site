import { describe, it, expect } from "vitest";
import { clusterFingerprint } from "@/lib/proposer/fingerprint";

describe("clusterFingerprint", () => {
  it("returns 16 hex chars", () => {
    const fp = clusterFingerprint(["sig_1", "sig_2"]);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });
  it("is order-independent", () => {
    expect(clusterFingerprint(["sig_a", "sig_b", "sig_c"]))
      .toBe(clusterFingerprint(["sig_c", "sig_a", "sig_b"]));
  });
  it("differs when one id differs", () => {
    expect(clusterFingerprint(["sig_a", "sig_b"]))
      .not.toBe(clusterFingerprint(["sig_a", "sig_c"]));
  });
  it("handles single-id cluster", () => {
    expect(clusterFingerprint(["sig_1"])).toMatch(/^[0-9a-f]{16}$/);
  });
  it("empty array returns deterministic hash", () => {
    const a = clusterFingerprint([]);
    const b = clusterFingerprint([]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
});
