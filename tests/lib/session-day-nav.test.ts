import { describe, expect, it } from "vitest";

import { getDaySessionNav } from "@/lib/sessions/session-content";

describe("getDaySessionNav", () => {
  it("returns prev/next sibling session ids within the same day in reader order", () => {
    // 2026-08-07 has asia-open, ny-open, global-close (reader order:
    // asia-open < europe-bridge < ny-open < global-close). europe-bridge は
    // 当日 GREEN anchor が無く欠番 — nav は在るセッションだけを繋ぐ。
    const nav = getDaySessionNav("2026-08-07-ny-open");
    expect(nav.prev?.sessionSlug).toBe("asia-open");
    expect(nav.next?.sessionSlug).toBe("global-close");
  });

  it("returns null nav for an unknown session id", () => {
    const nav = getDaySessionNav("2099-01-01-asia-open");
    expect(nav.prev).toBeNull();
    expect(nav.next).toBeNull();
  });
});
