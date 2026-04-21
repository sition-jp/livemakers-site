import fs from "fs";
import { z } from "zod";

export const ProposerRunStatusSchema = z.enum(["ok", "warn", "error"]);
export type ProposerRunStatus = z.infer<typeof ProposerRunStatusSchema>;

export const ProposerRunEntrySchema = z
  .object({
    run_id: z.string(),
    run_at: z.string().datetime(),
    proposer_version: z.string(),
    status: ProposerRunStatusSchema,
    clusters_detected: z.number().int().min(0),
    clusters_after_dedupe: z.number().int().min(0),
    proposals_created: z.number().int().min(0),
    mixed_skipped: z.number().int().min(0),
    warnings: z.array(z.string()).optional(),
    error: z.string().optional(),
  })
  .refine(
    (d) => d.status !== "error" || (d.error !== undefined && d.error.length > 0),
    { message: "error field required (non-empty) when status='error'" },
  )
  .refine(
    (d) => d.status !== "warn" || (d.warnings !== undefined && d.warnings.length > 0),
    { message: "warnings field required (non-empty) when status='warn'" },
  )
  .refine(
    (d) => d.status !== "ok" || (d.error === undefined && d.warnings === undefined),
    { message: "warnings/error must be absent when status='ok'" },
  );

export type ProposerRunEntry = z.infer<typeof ProposerRunEntrySchema>;

// Single-writer assumption (CLI-driven). No concurrent-write protection here;
// callers that share the log file must serialize externally.
export function appendRunLogEntry(path: string, entry: ProposerRunEntry): void {
  ProposerRunEntrySchema.parse(entry);
  fs.appendFileSync(path, JSON.stringify(entry) + "\n");
}

/**
 * Read the latest valid run-log entry, scanning from end. Returns null if
 * the file is missing or has no valid entries.
 *
 * Forward-compatible: lines that fail schema validation are silently skipped
 * (enum expansion or new fields in v0.2-β may appear in newer log entries
 * that older readers cannot parse — we prefer the latest *parseable* entry).
 *
 * CLI-only reader: missing file returns null; other I/O errors propagate
 * unstructured. Do not call from API routes without wrapping.
 */
export function readLastRunLog(path: string): ProposerRunEntry | null {
  if (!fs.existsSync(path)) return null;
  const raw = fs.readFileSync(path, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = ProposerRunEntrySchema.safeParse(JSON.parse(lines[i]));
      if (parsed.success) return parsed.data;
    } catch {
      // skip malformed
    }
  }
  return null;
}
