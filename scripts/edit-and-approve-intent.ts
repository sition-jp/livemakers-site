#!/usr/bin/env node
// scripts/edit-and-approve-intent.ts
// Morning Review Gate edit + approve action.

import fs from "fs";
import { readAndParseIntents } from "@/lib/intents-reader";
import { TradeIntentSchema, type TradeIntent } from "@/lib/intents";

export interface EditAndApproveArgs {
  intentsJsonlPath: string;
  intentId: string;
  patch: Partial<TradeIntent>;
  nowIso: string;
}

export interface EditAndApproveResult {
  intent: TradeIntent;
}

/**
 * Apply patch to a proposed Intent and approve in one atomic step (new row
 * appended to tradeintents.jsonl).
 *
 * Immutable fields (cannot be changed via patch):
 *   - intent_id
 *   - created_at
 *   - authored_via
 *   - proposer_metadata
 *
 * Same approve guards as approveIntent:
 *   - placeholder <<MANUAL:>> must be resolved
 *   - display.headline_en / summary_en must be non-empty (bilingual)
 *   - intent must currently be in proposed status
 *
 * Spec §5.4 §2.5 / Task 2-2 v0.2-alpha
 */
export async function editAndApproveIntent(args: EditAndApproveArgs): Promise<EditAndApproveResult> {
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

  // Merge: current + patch, then override invariants
  const merged: TradeIntent = {
    ...current,
    ...args.patch,
    // Immutable fields (spec §2.5)
    intent_id: current.intent_id,
    created_at: current.created_at,
    authored_via: current.authored_via,
    proposer_metadata: current.proposer_metadata,
    // Approval-time fields
    status: "approved",
    visibility: "public",
    updated_at: args.nowIso,
    human_review: {
      ...current.human_review,
      ...(args.patch.human_review ?? {}),
      approved_by: "LiveMakers Terminal",
      approved_at: args.nowIso,
    },
    display: {
      ...current.display,
      ...(args.patch.display ?? {}),
    },
  };

  // Post-merge guards
  if (/<<MANUAL:\s*/.test(merged.invalidation_thesis)) {
    throw new Error(
      "placeholder present in invalidation_thesis — resolve before approve",
    );
  }
  if (
    !merged.display.headline_en ||
    merged.display.headline_en.length === 0 ||
    !merged.display.summary_en ||
    merged.display.summary_en.length === 0
  ) {
    throw new Error(
      "bilingual display required before approve (headline_en + summary_en non-empty)",
    );
  }

  const parsed = TradeIntentSchema.parse(merged);
  fs.appendFileSync(args.intentsJsonlPath, JSON.stringify(parsed) + "\n");

  return { intent: parsed };
}

if (require.main === module) {
  const idIdx = process.argv.indexOf("--id");
  const patchIdx = process.argv.indexOf("--patch");
  if (idIdx === -1 || patchIdx === -1) {
    console.error(
      "usage: edit-and-approve-intent --id <intent_id> --patch '<json>'",
    );
    process.exit(1);
  }
  const patch = JSON.parse(process.argv[patchIdx + 1]);
  editAndApproveIntent({
    intentsJsonlPath: process.env.LM_INTENTS_JSONL_PATH ?? "",
    intentId: process.argv[idIdx + 1],
    patch,
    nowIso: new Date().toISOString(),
  })
    .then((r) => {
      console.log(JSON.stringify({ ok: true, intent_id: r.intent.intent_id }, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(JSON.stringify({ ok: false, error: String(e) }, null, 2));
      process.exit(1);
    });
}
