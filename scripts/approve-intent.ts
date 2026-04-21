#!/usr/bin/env node
// scripts/approve-intent.ts
// Morning Review Gate accept action. proposed → approved, same intent_id.

import fs from "fs";
import { readAndParseIntents } from "@/lib/intents-reader";
import { TradeIntentSchema, type TradeIntent } from "@/lib/intents";

export interface ApproveIntentArgs {
  intentsJsonlPath: string;
  intentId: string;
  nowIso: string;
}

export interface ApproveIntentResult {
  ok: true;
  intent: TradeIntent;
}

/**
 * Approve a proposed Intent. Blocks if:
 * - placeholder `<<MANUAL:>>` remains in invalidation_thesis (edit first)
 * - display.headline_en or summary_en is empty (bilingual must be generated
 *   before approve, Finding 5)
 * - intent is not currently in `proposed` status (latest row wins)
 *
 * On success: appends an approved row to tradeintents.jsonl with same
 * intent_id + visibility=public + approved_by="LiveMakers Terminal" +
 * approved_at=nowIso.
 *
 * Spec §5.3 §2.5 / Task 2-2 v0.2-alpha
 */
export async function approveIntent(args: ApproveIntentArgs): Promise<ApproveIntentResult> {
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

  // Placeholder guard
  if (/<<MANUAL:\s*/.test(current.invalidation_thesis)) {
    throw new Error(
      "placeholder present in invalidation_thesis — edit required before approve",
    );
  }
  // Bilingual guard (Finding 5)
  if (!current.display.headline_en || current.display.headline_en.length === 0) {
    throw new Error(
      "display.headline_en is empty — bilingual generation required before approve",
    );
  }
  if (!current.display.summary_en || current.display.summary_en.length === 0) {
    throw new Error(
      "display.summary_en is empty — bilingual generation required before approve",
    );
  }

  const approvedRow: TradeIntent = {
    ...current,
    status: "approved",
    visibility: "public",
    updated_at: args.nowIso,
    human_review: {
      ...current.human_review,
      approved_by: "LiveMakers Terminal",
      approved_at: args.nowIso,
    },
  };
  const parsed = TradeIntentSchema.parse(approvedRow);
  fs.appendFileSync(args.intentsJsonlPath, JSON.stringify(parsed) + "\n");

  return { ok: true, intent: parsed };
}

if (require.main === module) {
  const idIdx = process.argv.indexOf("--id");
  if (idIdx === -1 || !process.argv[idIdx + 1]) {
    console.error("usage: approve-intent --id <intent_id>");
    process.exit(1);
  }
  approveIntent({
    intentsJsonlPath: process.env.LM_INTENTS_JSONL_PATH ?? "",
    intentId: process.argv[idIdx + 1],
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
