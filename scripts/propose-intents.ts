#!/usr/bin/env node
// scripts/propose-intents.ts
// Nightly proposer CLI — called by SDE at 23:03 JST.
// Non-blocking: always exits 0; errors logged to stderr + run-log.
//
// Orchestrates Phase A-E modules:
//   readActiveSignals (B1) → detectClusters (C1) → filterDuplicateClusters (C2)
//   → readMarketPrices (B2) → buildDraftInput (D3) → createProposedIntent (E1)
//   → appendRunLogEntry (A6)
//
// Spec: §5.2 / §5.3 / §6.1 / §6.2 / Task 2-2 v0.2-alpha

import crypto from "crypto";
import { PROPOSER_CONFIG } from "@/lib/proposer/config";
import { readActiveSignals } from "@/lib/proposer/signal-reader";
import { detectClusters } from "@/lib/proposer/cluster-detect";
import { filterDuplicateClusters } from "@/lib/proposer/cluster-dedupe";
import { readAndParseIntents } from "@/lib/intents-reader";
import { readRejectLog } from "@/lib/intents-reject";
import { readMarketPrices } from "@/lib/proposer/market-price";
import { buildDraftInput } from "@/lib/proposer/field-mapper";
import { createProposedIntent } from "@/lib/intent-authoring";
import { appendRunLogEntry, type ProposerRunEntry } from "@/lib/proposer/run-log";

export interface RunProposerArgs {
  signalsPath: string;
  intentsPath: string;
  marketPath: string;
  rejectLogPath: string;
  runLogPath: string;
  nowIso: string;
  dryRun: boolean;
}

export interface RunProposerResult {
  status: "ok" | "warn" | "error";
  clusters_detected: number;
  clusters_after_dedupe: number;
  proposals_created: number;
  mixed_skipped: number;
  warnings?: string[];
  error?: string;
  proposals: Array<{ intent_id: string; primary_asset: string; fingerprint: string }>;
}

/**
 * Orchestrate the nightly proposer pipeline.
 *
 * Non-blocking: wraps every phase in try/catch, accumulates warnings,
 * appends a single run-log row per invocation. Always returns (never throws).
 *
 * Spec §5.2 §5.3 §6.1 §6.2 / Task 2-2 v0.2-alpha
 */
export async function runProposer(args: RunProposerArgs): Promise<RunProposerResult> {
  const runId = `r-${crypto.randomUUID()}`;
  const warnings: string[] = [];

  // Step 1: read active signals
  let signals: ReturnType<typeof readActiveSignals>;
  try {
    signals = readActiveSignals({
      signalsJsonlPath: args.signalsPath,
      windowHours: PROPOSER_CONFIG.time_window_hours,
      nowIso: args.nowIso,
    });
  } catch (e) {
    return finalize("error", 0, 0, 0, 0, [], `signal-reader failed: ${String(e)}`, []);
  }

  // Step 2: detect clusters
  const { clusters, mixed_skipped } = detectClusters(signals, PROPOSER_CONFIG);

  // Step 3: dedupe against active intents + reject log
  const { intents } = readAndParseIntents(args.intentsPath);
  const rejects = readRejectLog(
    args.rejectLogPath,
    PROPOSER_CONFIG.dedupe_reject_lookback_hours,
  );
  const deduped = filterDuplicateClusters({
    candidates: clusters,
    activeIntents: intents,
    rejectLog: rejects,
    jaccardThreshold: PROPOSER_CONFIG.dedupe_signal_overlap_jaccard,
  });

  // Step 4: slice top-N
  const topN = deduped.slice(0, PROPOSER_CONFIG.max_proposals_per_night);

  // Step 5: read market prices
  const prices = await readMarketPrices({
    marketIndicatorsJsonlPath: args.marketPath,
    assets: PROPOSER_CONFIG.supported_assets,
  });

  // Step 6: build drafts + persist
  const knownSignalIds = new Set(signals.map((s) => s.id));
  const proposals: RunProposerResult["proposals"] = [];
  for (const cluster of topN) {
    try {
      const { input, warnings: draftWarnings } = buildDraftInput(cluster, {
        currentPrices: prices,
        nowIso: args.nowIso,
      });
      // Merge field-mapper warnings (unmapped_side_combo / unmapped_pillar)
      warnings.push(...draftWarnings);

      if (!args.dryRun) {
        const result = await createProposedIntent(input, {
          jsonlPath: args.intentsPath,
          knownSignalIds,
        });
        if (result.warnings?.placeholderPresent) {
          warnings.push(
            `placeholder used for ${cluster.primary_asset} (market price missing)`,
          );
        }
        proposals.push({
          intent_id: result.intent.intent_id,
          primary_asset: cluster.primary_asset,
          fingerprint: cluster.fingerprint,
        });
      } else {
        proposals.push({
          intent_id: "int_proposed_(dry-run)",
          primary_asset: cluster.primary_asset,
          fingerprint: cluster.fingerprint,
        });
      }
    } catch (e) {
      warnings.push(
        `createProposedIntent failed for ${cluster.fingerprint}: ${String(e)}`,
      );
    }
  }

  const status: "ok" | "warn" = warnings.length > 0 ? "warn" : "ok";
  return finalize(
    status,
    clusters.length,
    deduped.length,
    proposals.length,
    mixed_skipped,
    warnings,
    undefined,
    proposals,
  );

  function finalize(
    status: "ok" | "warn" | "error",
    clusters_detected: number,
    clusters_after_dedupe: number,
    proposals_created: number,
    mixed_skipped: number,
    warnings_: string[],
    errorStr: string | undefined,
    proposals: RunProposerResult["proposals"],
  ): RunProposerResult {
    if (!args.dryRun) {
      const entry: ProposerRunEntry = {
        run_id: runId,
        run_at: args.nowIso,
        proposer_version: PROPOSER_CONFIG.version,
        status,
        clusters_detected,
        clusters_after_dedupe,
        proposals_created,
        mixed_skipped,
        ...(status === "warn" ? { warnings: warnings_ } : {}),
        ...(status === "error" ? { error: errorStr ?? "unknown error" } : {}),
      };
      try {
        appendRunLogEntry(args.runLogPath, entry);
      } catch {
        // Best-effort; don't let run-log failure cascade
      }
    }
    return {
      status,
      clusters_detected,
      clusters_after_dedupe,
      proposals_created,
      mixed_skipped,
      ...(warnings_.length > 0 ? { warnings: warnings_ } : {}),
      ...(errorStr ? { error: errorStr } : {}),
      proposals,
    };
  }
}

// CLI entry
if (require.main === module) {
  const args: RunProposerArgs = {
    signalsPath: process.env.LM_SIGNALS_JSONL_PATH ?? "",
    intentsPath: process.env.LM_INTENTS_JSONL_PATH ?? "",
    marketPath: process.env.LM_MARKET_INDICATORS_JSONL_PATH ?? "",
    rejectLogPath: process.env.LM_REJECT_LOG_JSONL_PATH ?? "",
    runLogPath: process.env.LM_PROPOSER_RUN_LOG_JSONL_PATH ?? "",
    nowIso: new Date().toISOString(),
    dryRun: process.argv.includes("--dry-run"),
  };
  runProposer(args)
    .then((result) => {
      // Terminal-friendly summary for SDE
      console.log(`─── 📬 PROPOSED INTENTS ───`);
      console.log(
        `  Proposer status:  ${result.status}  (${PROPOSER_CONFIG.version} / ${result.proposals_created} drafts)`,
      );
      if (result.warnings && result.warnings.length > 0) {
        console.log(`  Warnings: ${result.warnings.join(" / ")}`);
      }
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      for (const p of result.proposals) {
        console.log(`  ▸ ${p.intent_id}  (${p.primary_asset})`);
      }
      console.log(`\n→ 明朝 /sde-morning-p2 で review してください。`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(`proposer fatal: ${String(e)}`);
      process.exit(0); // non-blocking
    });
}
