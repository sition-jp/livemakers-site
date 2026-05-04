/**
 * Phase 2 producer's post-write defense-in-depth: parse the materialized
 * snapshot files through the SoT zod schemas. The producer CLI invokes
 * this test against the *.tmp paths (via PIVOTS_*_PATH env vars) BEFORE
 * promoting the tmps over the real targets, so that a malformed payload
 * never replaces a good snapshot.
 *
 * When env vars are not set, this test runs against the committed
 * data/pivot_*.live.json (which Phase 1 mock + Phase 2 producer both keep
 * schema-compliant).
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import {
  PivotAssetsSnapshotSchema,
  PivotBacktestSnapshotSchema,
} from "@/lib/pivots/types";

const repoRoot = path.resolve(__dirname, "..", "..");

const assetsPath =
  process.env.PIVOTS_ASSETS_PATH ?? path.join(repoRoot, "data", "pivot_assets.live.json");
const backtestPath =
  process.env.PIVOTS_BACKTEST_PATH ?? path.join(repoRoot, "data", "pivot_backtest.live.json");

describe("pivots snapshot files validate against zod SoT", () => {
  test("pivot_assets.live.json conforms to PivotAssetsSnapshotSchema", () => {
    const raw = fs.readFileSync(assetsPath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = PivotAssetsSnapshotSchema.safeParse(parsed);
    if (!result.success) {
      // Surface every issue so the producer's stderr captures the full reason.
      console.error(JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });

  test("pivot_backtest.live.json conforms to PivotBacktestSnapshotSchema", () => {
    const raw = fs.readFileSync(backtestPath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = PivotBacktestSnapshotSchema.safeParse(parsed);
    if (!result.success) {
      console.error(JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });
});
