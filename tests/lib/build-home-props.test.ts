import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildHomeCompositionProps } from "@/lib/home/build-home-props";
import { loadMarketSnapshot } from "@/lib/home/market-snapshot";
import { loadFocusSeriesRecords } from "@/lib/sessions/focus-series";

describe("build-home-props as-of integration (P1-2)", () => {
  const props = buildHomeCompositionProps({
    today: "2026-07-10",
    contentDir: path.join(process.cwd(), "tests", "fixtures", "content", "articles"),
  });
  const snapshot = loadMarketSnapshot();

  it("uses snapshot as-of for label and market provenance", () => {
    expect(props.asOfLabel).toBe(snapshot.asOfLabel);
    expect(props.pageProvenance.asOfJst).toBe(snapshot.asOfLabel);
    expect(props.mkt12Provenance.asOfJst).toBe(snapshot.asOfLabel);
  });

  it("includes the newest fixture record through the snapshot window end", () => {
    for (const series of props.focusSeries.filter(
      (candidate) => candidate !== null,
    )) {
      const newestInWindow = loadFocusSeriesRecords()
        .filter(
          (record) =>
            record.instrumentId === series!.instrumentId &&
            record.atJst <= snapshot.asOfJst,
        )
        .sort((left, right) => left.atJst.localeCompare(right.atJst))
        .at(-1)!;
      expect(series!.points.at(-1)!.atJst).toBe(newestInWindow.atJst);
      expect(series!.points.at(-1)!.atJst <= snapshot.asOfJst).toBe(true);
    }
    expect(
      props.focusSeries.some(
        (series) =>
          series?.points.at(-1)?.atJst ===
          "2026-07-10T07:30:00+09:00",
      ),
    ).toBe(true);
  });

  it("fails closed when snapshot date and today disagree", () => {
    expect(() => buildHomeCompositionProps({ today: "2026-07-11" })).toThrow(
      /does not match today/,
    );
  });

  it("passes an injected contentDir through to article selection", () => {
    const empty = buildHomeCompositionProps({
      today: "2026-07-10",
      contentDir: path.join(process.cwd(), "tests", "fixtures", "missing-content"),
    });
    expect(empty.slots.lead.state).toBe("pending");
  });
});
