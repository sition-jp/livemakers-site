import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import {
  TerminalAssetsSnapshotSchema,
  AssetSummarySchema,
  DashboardResponseSchema,
} from "@/lib/terminal/asset-summary";

const FIXTURE_DIR = path.join(__dirname, "../../fixtures/terminal");

function loadFixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, name), "utf-8"),
  );
}

describe("Terminal Asset Contract zod schema", () => {
  describe("happy path — fixtures parse cleanly", () => {
    it("parses canonical terminal_assets.sample.json without error", () => {
      const data = loadFixture("terminal_assets.sample.json");
      const result = TerminalAssetsSnapshotSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("parses dashboard.sample.json (DashboardResponseSchema)", () => {
      const data = loadFixture("dashboard.sample.json");
      const result = DashboardResponseSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("parses asset_summary_ada.sample.json (AssetSummarySchema)", () => {
      const data = loadFixture("asset_summary_ada.sample.json");
      const result = AssetSummarySchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("price nullability — DexScreener degrade case", () => {
    it("accepts null market_cap_usd and volume_24h_usd (NIGHT/DexScreener pattern)", () => {
      const data = loadFixture("terminal_assets.sample.json") as {
        assets: { NIGHT: unknown };
      };
      const night = AssetSummarySchema.safeParse(data.assets.NIGHT);
      expect(night.success).toBe(true);
      if (night.success) {
        expect(night.data.price?.market_cap_usd).toBeNull();
        expect(night.data.price?.volume_24h_usd).toBeNull();
      }
    });
  });

  describe("invariants — schema violations are rejected", () => {
    it("rejects signals.items.length > total_active (refine)", () => {
      const data = loadFixture("terminal_assets.sample.json") as {
        assets: { ADA: { signals: { total_active: number; items: unknown[] } } };
      };
      // ADA fixture has 6 active, 3 items — set total_active to 1 to violate refine
      const broken = JSON.parse(JSON.stringify(data));
      broken.assets.ADA.signals.total_active = 1;
      const result = TerminalAssetsSnapshotSchema.safeParse(broken);
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message).join(" | ");
        expect(messages).toContain("cannot exceed total_active");
      }
    });

    it("rejects missing required asset (e.g. ADA dropped)", () => {
      const data = loadFixture("terminal_assets.sample.json") as {
        assets: Record<string, unknown>;
      };
      const broken = JSON.parse(JSON.stringify(data));
      delete broken.assets.ADA;
      const result = TerminalAssetsSnapshotSchema.safeParse(broken);
      expect(result.success).toBe(false);
    });

    it("rejects wrong type on confidence (string instead of number)", () => {
      const data = loadFixture("terminal_assets.sample.json") as {
        assets: {
          ADA: { signals: { items: Array<{ confidence: number | string }> } };
        };
      };
      const broken = JSON.parse(JSON.stringify(data));
      broken.assets.ADA.signals.items[0].confidence = "high";
      const result = TerminalAssetsSnapshotSchema.safeParse(broken);
      expect(result.success).toBe(false);
    });

    it("rejects unknown TerminalAsset enum value", () => {
      const data = loadFixture("terminal_assets.sample.json") as {
        assets: {
          ADA: { asset: string };
        };
      };
      const broken = JSON.parse(JSON.stringify(data));
      broken.assets.ADA.asset = "DOGE";
      const result = TerminalAssetsSnapshotSchema.safeParse(broken);
      expect(result.success).toBe(false);
    });
  });

  describe("documentation passthrough — _-prefixed fields", () => {
    it("ignores _fixture_note at top level without erroring", () => {
      const data = loadFixture("dashboard.sample.json");
      const result = DashboardResponseSchema.safeParse(data);
      // dashboard.sample.json has _fixture_note at top — must still parse
      expect(result.success).toBe(true);
    });
  });

  describe("cross-fixture equivalence — ADA payload identical across 3 fixtures", () => {
    /**
     * Fixture invariant: terminal_assets.assets.ADA, dashboard.assets.ADA,
     * and asset_summary_ada.sample.json must be byte-equivalent (after
     * stripping `_*` documentation fields). Any drift means at least one
     * fixture is wrong; the spec contract (§7.1) requires identical content.
     */
    function stripMeta(value: unknown): unknown {
      if (Array.isArray(value)) return value.map(stripMeta);
      if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          if (k.startsWith("_")) continue;
          out[k] = stripMeta(v);
        }
        return out;
      }
      return value;
    }

    it("terminal_assets.ADA == dashboard.ADA", () => {
      const ta = loadFixture("terminal_assets.sample.json") as {
        assets: Record<string, unknown>;
      };
      const db = loadFixture("dashboard.sample.json") as {
        assets: Record<string, unknown>;
      };
      expect(stripMeta(ta.assets.ADA)).toEqual(stripMeta(db.assets.ADA));
    });

    it("terminal_assets.ADA == asset_summary_ada", () => {
      const ta = loadFixture("terminal_assets.sample.json") as {
        assets: Record<string, unknown>;
      };
      const single = loadFixture("asset_summary_ada.sample.json");
      expect(stripMeta(ta.assets.ADA)).toEqual(stripMeta(single));
    });

    it("dashboard.assets.NIGHT keeps null mcap/volume (no silent coercion)", () => {
      const db = loadFixture("dashboard.sample.json") as {
        assets: { NIGHT: { price: { market_cap_usd: null; volume_24h_usd: null } } };
      };
      expect(db.assets.NIGHT.price.market_cap_usd).toBeNull();
      expect(db.assets.NIGHT.price.volume_24h_usd).toBeNull();
    });
  });

  describe("source_freshness forward-compat — accepts both shapes", () => {
    it("accepts number (v0)", () => {
      const data = loadFixture("terminal_assets.sample.json");
      const result = TerminalAssetsSnapshotSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("accepts structured object (Phase 1.1)", () => {
      const data = loadFixture("terminal_assets.sample.json") as {
        source_freshness_sec: number | object;
      };
      const upgraded = JSON.parse(JSON.stringify(data));
      upgraded.source_freshness_sec = {
        signals_sec: 100,
        news_sec: 200,
        price_sec: 30,
        governance_sec: 600,
      };
      const result = TerminalAssetsSnapshotSchema.safeParse(upgraded);
      expect(result.success).toBe(true);
    });
  });
});
