import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runProposer } from "@/scripts/propose-intents";

let tmpDir: string;
let ctx: {
  signalsPath: string;
  intentsPath: string;
  marketPath: string;
  rejectLogPath: string;
  runLogPath: string;
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "propose-intents-"));
  ctx = {
    signalsPath: path.join(tmpDir, "signals.jsonl"),
    intentsPath: path.join(tmpDir, "tradeintents.jsonl"),
    marketPath: path.join(tmpDir, "market-indicators.jsonl"),
    rejectLogPath: path.join(tmpDir, "intent-reject-log.jsonl"),
    runLogPath: path.join(tmpDir, "proposer-run-log.jsonl"),
  };
});

function writeSig(p: string, overrides: Record<string, any>) {
  const base = {
    id: "sig_x",
    trace_id: "550e8400-e29b-41d4-a716-446655440000",
    root_trace_id: "rt",
    schema_version: "1.1-beta",
    created_at: "2026-04-21T12:00:00Z",
    type: "governance_shift",
    subtype: "drep",
    pillar: "governance_and_treasury",
    status: "active",
    idempotency_key: "idem-default",
    confidence: 0.78,
    impact: "high",
    urgency: 0.5,
    time_horizon: "2-4 weeks",
    direction: "positive",
    primary_asset: "ADA",
    related_assets: ["ADA"],
    related_protocols: [],
    tradable: true,
    position_hint: { stance: "accumulate", conviction: 0.7 },
    evidence: [],
    similar_cases: [],
    headline_en: "ADA gov",
    headline_ja: "ADA ガバナンス",
    summary_en: "gov summary — enough length to satisfy minimum twenty",
    summary_ja: "ADA ガバナンス局面の要旨で二十文字を超える十分な長さ",
    source_ids: [],
    ...overrides,
  };
  fs.appendFileSync(p, JSON.stringify(base) + "\n");
}

describe("runProposer — happy path", () => {
  it("returns status=ok and writes proposals when signals qualify", async () => {
    writeSig(ctx.signalsPath, { id: "sig_1", idempotency_key: "i1" });
    writeSig(ctx.signalsPath, { id: "sig_2", idempotency_key: "i2", confidence: 0.65, impact: "medium" });
    fs.writeFileSync(
      ctx.marketPath,
      JSON.stringify({ date: "2026-04-21", ada: 0.251 }) + "\n",
    );

    const result = await runProposer({
      ...ctx,
      nowIso: "2026-04-21T23:03:00Z",
      dryRun: false,
    });

    expect(result.status).toBe("ok");
    expect(result.proposals_created).toBe(1);
    expect(fs.readFileSync(ctx.intentsPath, "utf-8").split("\n").filter(Boolean)).toHaveLength(1);
    expect(fs.readFileSync(ctx.runLogPath, "utf-8").split("\n").filter(Boolean)).toHaveLength(1);
  });
});

describe("runProposer — edge cases", () => {
  it("returns ok with 0 proposals when no clusters qualify (empty signals)", async () => {
    fs.writeFileSync(ctx.signalsPath, "");
    fs.writeFileSync(ctx.marketPath, "");
    const result = await runProposer({
      ...ctx,
      nowIso: "2026-04-21T23:03:00Z",
      dryRun: false,
    });
    expect(result.status).toBe("ok");
    expect(result.proposals_created).toBe(0);
  });

  it("status=warn when market price missing → placeholder fallback used", async () => {
    writeSig(ctx.signalsPath, { id: "sig_1", idempotency_key: "i1" });
    writeSig(ctx.signalsPath, { id: "sig_2", idempotency_key: "i2", confidence: 0.65, impact: "medium" });
    // No market file → readMarketPrices returns {} → placeholder path
    const result = await runProposer({
      ...ctx,
      nowIso: "2026-04-21T23:03:00Z",
      dryRun: false,
    });
    expect(result.status).toBe("warn");
    expect(result.proposals_created).toBe(1);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes("placeholder"))).toBe(true);
  });

  it("dryRun=true does not write jsonl files", async () => {
    writeSig(ctx.signalsPath, { id: "sig_1", idempotency_key: "i1" });
    writeSig(ctx.signalsPath, { id: "sig_2", idempotency_key: "i2", confidence: 0.65, impact: "medium" });
    fs.writeFileSync(
      ctx.marketPath,
      JSON.stringify({ date: "2026-04-21", ada: 0.251 }) + "\n",
    );
    await runProposer({ ...ctx, nowIso: "2026-04-21T23:03:00Z", dryRun: true });
    expect(fs.existsSync(ctx.intentsPath)).toBe(false);
    expect(fs.existsSync(ctx.runLogPath)).toBe(false);
  });

  it("dedupe against recent reject log skips matching cluster", async () => {
    writeSig(ctx.signalsPath, { id: "sig_1", idempotency_key: "i1" });
    writeSig(ctx.signalsPath, { id: "sig_2", idempotency_key: "i2", confidence: 0.65, impact: "medium" });
    fs.writeFileSync(ctx.marketPath, JSON.stringify({ date: "2026-04-21", ada: 0.251 }) + "\n");

    // Pre-populate reject-log with the cluster's expected fingerprint
    // Cluster fingerprint = SHA256 of sorted signal IDs "sig_1|sig_2" → 16 hex chars
    // We don't know the exact hash, so do a first run to populate, then check second run skips
    const first = await runProposer({
      ...ctx,
      nowIso: "2026-04-21T23:03:00Z",
      dryRun: false,
    });
    expect(first.proposals_created).toBe(1);

    // Fake reject for same cluster
    const firstIntentRaw = fs.readFileSync(ctx.intentsPath, "utf-8").split("\n").filter(Boolean)[0];
    const firstIntent = JSON.parse(firstIntentRaw);
    const fp = firstIntent.proposer_metadata.cluster_fingerprint;
    fs.writeFileSync(
      ctx.rejectLogPath,
      JSON.stringify({
        intent_id: firstIntent.intent_id,
        source_signal_ids: ["sig_1", "sig_2"],
        cluster_fingerprint: fp,
        proposer_version: "v0.2-alpha-rule",
        rejected_at: "2026-04-21T23:30:00Z",
        reason: "duplicate_of_approved",
      }) + "\n",
    );

    // Clear proposer output, run again — should skip due to reject log match
    fs.writeFileSync(ctx.intentsPath, "");
    const second = await runProposer({
      ...ctx,
      nowIso: "2026-04-21T23:35:00Z",
      dryRun: false,
    });
    expect(second.proposals_created).toBe(0);
  });
});
