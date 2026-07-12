import { describe, expect, it } from "vitest";

import { getDaySessionNav } from "@/lib/sessions/session-content";

describe("getDaySessionNav", () => {
  it("returns prev/next sibling session ids within the same day in reader order", () => {
    // 2026-07-09 has europe-bridge, ny-open, global-close (reader order:
    // asia-open < europe-bridge < ny-open < global-close).
    const nav = getDaySessionNav("2026-07-09-ny-open");
    expect(nav.prev?.sessionSlug).toBe("europe-bridge");
    expect(nav.next?.sessionSlug).toBe("global-close");
  });

  it("returns null nav for an unknown session id", () => {
    const nav = getDaySessionNav("2099-01-01-asia-open");
    expect(nav.prev).toBeNull();
    expect(nav.next).toBeNull();
  });
});
