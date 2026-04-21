#!/usr/bin/env node
// scripts/reject-intent.ts
// Morning Review Gate reject action. proposed → cancelled + appends reject log.

import fs from "fs";
import { readAndParseIntents } from "@/lib/intents-reader";
import { TradeIntentSchema, type TradeIntent } from "@/lib/intents";
import {
  appendRejectEntry,
  RejectReasonSchema,
  type RejectReason,
} from "@/lib/intents-reject";

const R_NUMERIC_MAP: Record<string, RejectReason> = {
  r1: "weak_invalidation",
  r2: "low_conviction",
  r3: "duplicate_of_approved",
  r4: "wrong_direction",
  r5: "stale_signals",
  r6: "out_of_scope",
  r7: "thesis_disagree",
  r8: "other",
};

function normalizeReason(input: string): RejectReason {
  if (input in R_NUMERIC_MAP) return R_NUMERIC_MAP[input];
  const parsed = RejectReasonSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new Error(`invalid reason: ${input}`);
}

export interface RejectIntentArgs {
  intentsJsonlPath: string;
  rejectLogJsonlPath: string;
  intentId: string;
  reason: string;
  note?: string;
  nowIso: string;
}

/**
 * Reject a proposed Intent.
 *
 * - Accepts reason as r1-r8 numeric form or enum name directly
 * - note required when reason="other" (enforced by appendRejectEntry refine too)
 * - Transitions proposed → cancelled (same intent_id, new row)
 * - Appends entry to intent-reject-log.jsonl with reason + note +
 *   cluster_fingerprint
 *
 * Spec §5.5 §3.4 / Task 2-2 v0.2-alpha
 */
export async function rejectIntent(args: RejectIntentArgs): Promise<void> {
  const reason = normalizeReason(args.reason);
  if (reason === "other" && (!args.note || args.note.length === 0)) {
    throw new Error("note required when reason='other'");
  }

  const { intents } = readAndParseIntents(args.intentsJsonlPath);

  // Latest-row-wins per id
  const latest = new Map<string, TradeIntent>();
  for (const i of intents) {
    const prev = latest.get(i.intent_id);
    if (
      !prev ||
      Date.parse(i.updated_at ?? i.created_at) >=
        Date.parse(prev.updated_at ?? prev.created_at)
    ) {
      latest.set(i.intent_id, i);
    }
  }
  const current = latest.get(args.intentId);
  if (!current) {
    throw new Error(`intent not found: ${args.intentId}`);
  }
  if (current.status !== "proposed") {
    throw new Error(
      `intent ${args.intentId} is not in proposed status (current: ${current.status})`,
    );
  }

  // Append reject-log first (so intent stays proposed if log write fails).
  appendRejectEntry(args.rejectLogJsonlPath, {
    intent_id: current.intent_id,
    source_signal_ids: current.source_signal_ids,
    cluster_fingerprint: current.proposer_metadata?.cluster_fingerprint ?? "",
    proposer_version: current.proposer_metadata?.version ?? "unknown",
    rejected_at: args.nowIso,
    reason,
    ...(args.note ? { note: args.note } : {}),
  });

  const cancelledRow: TradeIntent = {
    ...current,
    status: "cancelled",
    visibility: "private",
    updated_at: args.nowIso,
  };
  const parsed = TradeIntentSchema.parse(cancelledRow);
  fs.appendFileSync(args.intentsJsonlPath, JSON.stringify(parsed) + "\n");
}

if (require.main === module) {
  const idIdx = process.argv.indexOf("--id");
  const reasonIdx = process.argv.indexOf("--reason");
  const noteIdx = process.argv.indexOf("--note");
  if (idIdx === -1 || reasonIdx === -1) {
    console.error(
      'usage: reject-intent --id <intent_id> --reason <r1-r8|enum> --note "..."',
    );
    process.exit(1);
  }
  rejectIntent({
    intentsJsonlPath: process.env.LM_INTENTS_JSONL_PATH ?? "",
    rejectLogJsonlPath: process.env.LM_REJECT_LOG_JSONL_PATH ?? "",
    intentId: process.argv[idIdx + 1],
    reason: process.argv[reasonIdx + 1],
    ...(noteIdx !== -1 ? { note: process.argv[noteIdx + 1] } : {}),
    nowIso: new Date().toISOString(),
  })
    .then(() => {
      console.log(JSON.stringify({ ok: true }, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(JSON.stringify({ ok: false, error: String(e) }, null, 2));
      process.exit(1);
    });
}
