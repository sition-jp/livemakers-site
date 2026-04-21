import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runProposer } from "@/scripts/propose-intents";
import { buildReviewDump } from "@/scripts/review-intents";
import { approveIntent } from "@/scripts/approve-intent";
import { rejectIntent } from "@/scripts/reject-intent";
import { runAutoExpire } from "@/scripts/auto-expire-proposals";
import { readRejectLog } from "@/lib/intents-reject";
import { readExpiryLog } from "@/lib/intents-expiry";
import { readLastRunLog } from "@/lib/proposer/run-log";

const FIXTURE_SIGNALS = path.join(
  __dirname,
  "../fixtures/proposer/integration/signals.jsonl",
);
const FIXTURE_MARKET = path.join(
  __dirname,
  "../fixtures/proposer/integration/market-indicators.jsonl",
);

let ctx: {
  signalsPath: string;
  intentsPath: string;
  marketPath: string;
  rejectLogPath: string;
  expiryLogPath: string;
  runLogPath: string;
  touchPath: string;
};

beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "int-pipeline-"));
  ctx = {
    signalsPath: path.join(tmp, "signals.jsonl"),
    intentsPath: path.join(tmp, "tradeintents.jsonl"),
    marketPath: path.join(tmp, "market-indicators.jsonl"),
    rejectLogPath: path.join(tmp, "intent-reject-log.jsonl"),
    expiryLogPath: path.join(tmp, "intent-expiry-log.jsonl"),
    runLogPath: path.join(tmp, "proposer-run-log.jsonl"),
    touchPath: path.join(tmp, "review-gate-touches.json"),
  };
  fs.copyFileSync(FIXTURE_SIGNALS, ctx.signalsPath);
  fs.copyFileSync(FIXTURE_MARKET, ctx.marketPath);
});

describe("proposer integration pipeline — end-to-end", () => {
  it("full night propose → morning review → approve + reject", async () => {
    // --- Night: propose ---
    const nightResult = await runProposer({
      ...ctx,
      nowIso: "2026-04-21T23:03:00Z",
      dryRun: false,
    });
    expect(nightResult.status).toMatch(/^(ok|warn)$/);
    expect(nightResult.mixed_skipped).toBe(2);
    // ADA positive (2 sigs) + BTC negative (2 sigs) = 2 clusters, both should propose
    expect(nightResult.proposals_created).toBe(2);

    // Verify run-log recorded
    const lastRun = readLastRunLog(ctx.runLogPath);
    expect(lastRun).not.toBeNull();
    expect(lastRun!.mixed_skipped).toBe(2);
    expect(lastRun!.proposals_created).toBe(2);

    // --- Morning: review dump ---
    const dump = await buildReviewDump({
      intentsJsonlPath: ctx.intentsPath,
      signalsJsonlPath: ctx.signalsPath,
      runLogJsonlPath: ctx.runLogPath,
      nowIso: "2026-04-22T05:15:00Z",
    });
    expect(dump.total_pending).toBe(2);
    expect(dump.proposer_last_run?.proposals_created).toBe(2);

    // --- Morning: approve ADA proposal ---
    const adaIntent = dump.pending.find((p) =>
      p.intent.target_assets.includes("ADA"),
    );
    expect(adaIntent).toBeDefined();

    // Simulate Claude Code filling bilingual EN display before approve
    const withEN = {
      ...adaIntent!.intent,
      display: {
        ...adaIntent!.intent.display,
        headline_en: "ADA accumulation amid governance momentum",
        summary_en: "Governance activity signals ADA floor support here.",
      },
    };
    fs.appendFileSync(ctx.intentsPath, JSON.stringify(withEN) + "\n");

    const approveResult = await approveIntent({
      intentsJsonlPath: ctx.intentsPath,
      intentId: adaIntent!.intent.intent_id,
      nowIso: "2026-04-22T05:20:00Z",
    });
    expect(approveResult.intent.status).toBe("approved");
    expect(approveResult.intent.visibility).toBe("public");

    // --- Morning: reject BTC proposal ---
    const btcIntent = dump.pending.find((p) =>
      p.intent.target_assets.includes("BTC"),
    );
    expect(btcIntent).toBeDefined();
    await rejectIntent({
      intentsJsonlPath: ctx.intentsPath,
      rejectLogJsonlPath: ctx.rejectLogPath,
      intentId: btcIntent!.intent.intent_id,
      reason: "thesis_disagree",
      note: "Macro narrative already priced in",
      nowIso: "2026-04-22T05:25:00Z",
    });

    const rejectLog = readRejectLog(ctx.rejectLogPath);
    expect(rejectLog).toHaveLength(1);
    expect(rejectLog[0].reason).toBe("thesis_disagree");
  });

  it("second nightly run dedupes against rejected fingerprint", async () => {
    // Night 1: propose 2, reject both
    const night1 = await runProposer({
      ...ctx,
      nowIso: "2026-04-21T23:03:00Z",
      dryRun: false,
    });
    expect(night1.proposals_created).toBe(2);

    const dump1 = await buildReviewDump({
      intentsJsonlPath: ctx.intentsPath,
      signalsJsonlPath: ctx.signalsPath,
      runLogJsonlPath: ctx.runLogPath,
      nowIso: "2026-04-22T05:15:00Z",
    });
    for (const card of dump1.pending) {
      await rejectIntent({
        intentsJsonlPath: ctx.intentsPath,
        rejectLogJsonlPath: ctx.rejectLogPath,
        intentId: card.intent.intent_id,
        reason: "stale_signals",
        nowIso: "2026-04-22T05:15:00Z",
      });
    }

    // Night 2: same signals → dedupe should skip both via reject fingerprints
    const night2 = await runProposer({
      ...ctx,
      nowIso: "2026-04-22T23:03:00Z",
      dryRun: false,
    });
    expect(night2.proposals_created).toBe(0);
    expect(night2.clusters_detected).toBeGreaterThanOrEqual(2);
    expect(night2.clusters_after_dedupe).toBe(0);
  });

  it("auto-expire creates expired row + expiry-log entry", async () => {
    await runProposer({
      ...ctx,
      nowIso: "2026-04-21T23:03:00Z",
      dryRun: false,
    });

    // 25h later without review
    const result = await runAutoExpire({
      intentsJsonlPath: ctx.intentsPath,
      expiryLogJsonlPath: ctx.expiryLogPath,
      touchStorePath: ctx.touchPath,
      nowIso: "2026-04-23T00:10:00Z",
    });

    expect(result.expired.length).toBeGreaterThanOrEqual(1);
    const expiryLog = readExpiryLog(ctx.expiryLogPath);
    expect(expiryLog.length).toBeGreaterThanOrEqual(1);
    expect(expiryLog[0].reason).toBe("timed_out_without_review");
    expect(expiryLog[0].skip_count).toBe(0);
  });
});
