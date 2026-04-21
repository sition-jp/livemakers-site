import fs from "fs";
import { z } from "zod";

export const RejectReasonSchema = z.enum([
  "weak_invalidation",
  "low_conviction",
  "duplicate_of_approved",
  "wrong_direction",
  "stale_signals",
  "out_of_scope",
  "thesis_disagree",
  "other",
]);
export type RejectReason = z.infer<typeof RejectReasonSchema>;

export const IntentRejectEntrySchema = z
  .object({
    intent_id: z.string(),
    source_signal_ids: z.array(z.string()),
    cluster_fingerprint: z.string(),
    proposer_version: z.string(),
    rejected_at: z.string().datetime(),
    reason: RejectReasonSchema,
    note: z.string().optional(),
  })
  .refine(
    (d) => d.reason !== "other" || (d.note !== undefined && d.note.length > 0),
    { message: "note is required when reason='other'" },
  );

export type IntentRejectEntry = z.infer<typeof IntentRejectEntrySchema>;

export function appendRejectEntry(path: string, entry: IntentRejectEntry): void {
  IntentRejectEntrySchema.parse(entry);
  fs.appendFileSync(path, JSON.stringify(entry) + "\n");
}

export function readRejectLog(
  path: string,
  windowHours?: number,
): IntentRejectEntry[] {
  if (!fs.existsSync(path)) return [];
  const raw = fs.readFileSync(path, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const cutoff =
    windowHours !== undefined
      ? Date.now() - windowHours * 3600 * 1000
      : undefined;
  const out: IntentRejectEntry[] = [];
  for (const line of lines) {
    try {
      const parsed = IntentRejectEntrySchema.safeParse(JSON.parse(line));
      if (!parsed.success) continue;
      if (cutoff !== undefined) {
        const rejectedMs = Date.parse(parsed.data.rejected_at);
        if (rejectedMs < cutoff) continue;
      }
      out.push(parsed.data);
    } catch {
      // skip malformed line (forward-compat)
    }
  }
  return out;
}
