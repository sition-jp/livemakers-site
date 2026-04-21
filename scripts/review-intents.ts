#!/usr/bin/env node
// scripts/review-intents.ts
// Morning Review Gate Step 0-b — dumps pending proposed intents as JSON.

import fs from "fs";
import { readAndParseIntents } from "@/lib/intents-reader";
import { SignalSchema, type Signal } from "@/lib/signals";
import { readLastRunLog, type ProposerRunEntry } from "@/lib/proposer/run-log";
import type { TradeIntent } from "@/lib/intents";

export interface ReviewCard {
  intent: TradeIntent;
  stale_source_signals: Array<{
    signal_id: string;
    status_at_proposal: "active";
    status_now: string;
    changed_at: string;
  }>;
  hours_since_created: number;
  hours_until_expiry: number;
}

export interface BuildReviewDumpArgs {
  intentsJsonlPath: string;
  signalsJsonlPath: string;
  runLogJsonlPath: string;
  nowIso: string;
}

export interface ReviewDump {
  pending: ReviewCard[];
  proposer_last_run: ProposerRunEntry | null;
  generated_at: string;
  total_pending: number;
}

function latestSignalMap(signalsPath: string): Map<string, Signal> {
  if (!fs.existsSync(signalsPath)) return new Map();
  const raw = fs.readFileSync(signalsPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const latest = new Map<string, Signal>();
  for (const line of lines) {
    try {
      const parsed = SignalSchema.safeParse(JSON.parse(line));
      if (!parsed.success) continue;
      const prev = latest.get(parsed.data.id);
      if (
        !prev ||
        Date.parse(parsed.data.created_at) >= Date.parse(prev.created_at)
      ) {
        latest.set(parsed.data.id, parsed.data);
      }
    } catch {
      // skip malformed
    }
  }
  return latest;
}

/**
 * Build Morning Review Gate dump:
 *   - Pending proposed intents (sde_auto_proposal + status=proposed, latest row wins)
 *   - Stale source signal detection (Finding 8)
 *   - Proposer last run status (from run-log)
 *   - Hours since created / hours until 24h expiry
 *
 * Spec §5.3 / §2.3 Step 0-b / Task 2-2 v0.2-alpha
 */
export async function buildReviewDump(
  args: BuildReviewDumpArgs,
): Promise<ReviewDump> {
  const { intents } = readAndParseIntents(args.intentsJsonlPath);

  // Latest-row-wins per intent_id
  const latestIntents = new Map<string, TradeIntent>();
  for (const i of intents) {
    const prev = latestIntents.get(i.intent_id);
    if (
      !prev ||
      Date.parse(i.updated_at ?? i.created_at) >=
        Date.parse(prev.updated_at ?? prev.created_at)
    ) {
      latestIntents.set(i.intent_id, i);
    }
  }

  const pending = [...latestIntents.values()].filter(
    (i) => i.status === "proposed" && i.authored_via === "sde_auto_proposal",
  );

  const signalMap = latestSignalMap(args.signalsJsonlPath);
  const nowMs = Date.parse(args.nowIso);

  const cards: ReviewCard[] = pending.map((intent) => {
    const stale: ReviewCard["stale_source_signals"] = [];
    for (const sid of intent.source_signal_ids) {
      const sig = signalMap.get(sid);
      if (sig && sig.status !== "active") {
        stale.push({
          signal_id: sid,
          status_at_proposal: "active",
          status_now: sig.status,
          changed_at: sig.created_at,
        });
      }
    }
    const createdMs = Date.parse(intent.created_at);
    const expiresMs = createdMs + 24 * 3600 * 1000;
    return {
      intent,
      stale_source_signals: stale,
      hours_since_created: Math.round((nowMs - createdMs) / 3600 / 1000),
      hours_until_expiry: Math.max(
        0,
        Math.round((expiresMs - nowMs) / 3600 / 1000),
      ),
    };
  });

  return {
    pending: cards,
    proposer_last_run: readLastRunLog(args.runLogJsonlPath),
    generated_at: args.nowIso,
    total_pending: cards.length,
  };
}

if (require.main === module) {
  buildReviewDump({
    intentsJsonlPath: process.env.LM_INTENTS_JSONL_PATH ?? "",
    signalsJsonlPath: process.env.LM_SIGNALS_JSONL_PATH ?? "",
    runLogJsonlPath: process.env.LM_PROPOSER_RUN_LOG_JSONL_PATH ?? "",
    nowIso: new Date().toISOString(),
  }).then((dump) => {
    console.log(JSON.stringify(dump, null, 2));
    process.exit(0);
  });
}
