#!/usr/bin/env node
// scripts/auto-expire-proposals.ts
// Called by Morning Review Gate Step 0-a. Non-interactive.

import { autoExpirePendingProposals } from "@/lib/proposer/auto-expire";
import { readTouches } from "@/lib/proposer/review-gate-touches";

export interface RunAutoExpireArgs {
  intentsJsonlPath: string;
  expiryLogJsonlPath: string;
  touchStorePath: string;
  nowIso: string;
}

export interface RunAutoExpireResult {
  expired: string[];
}

/**
 * Wire touch store into autoExpirePendingProposals for the Morning Review Gate.
 * Returns the list of intent_ids that transitioned to expired.
 *
 * Spec §2.3 Step 0-a / Task 2-2 v0.2-alpha
 */
export async function runAutoExpire(
  args: RunAutoExpireArgs,
): Promise<RunAutoExpireResult> {
  const touches = readTouches(args.touchStorePath);
  return autoExpirePendingProposals({
    intentsJsonlPath: args.intentsJsonlPath,
    expiryLogJsonlPath: args.expiryLogJsonlPath,
    nowIso: args.nowIso,
    expireAfterHours: 24,
    skipCountLookup: (id) => touches[id]?.skip_count ?? 0,
    lastSeenLookup: (id) => touches[id]?.last_seen_at,
  });
}

if (require.main === module) {
  runAutoExpire({
    intentsJsonlPath: process.env.LM_INTENTS_JSONL_PATH ?? "",
    expiryLogJsonlPath: process.env.LM_EXPIRY_LOG_JSONL_PATH ?? "",
    touchStorePath:
      process.env.LM_REVIEW_GATE_TOUCHES_PATH ?? "./data/review-gate-touches.json",
    nowIso: new Date().toISOString(),
  }).then((r) => {
    console.log(JSON.stringify({ expired: r.expired }, null, 2));
    process.exit(0);
  });
}
