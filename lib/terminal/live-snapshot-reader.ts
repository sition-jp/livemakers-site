/**
 * Terminal Live Snapshot — reader.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-30-sde-terminal-live-snapshot-v0.1.md §4.1-4.2
 *
 * Reads `terminal_assets.live.json` (SDE-producer-written) and returns a
 * parsed `TerminalLiveSnapshot`. Mirrors `snapshot-reader.ts` shape so the
 * `/api/dashboard/live` route can apply the same degrade matrix.
 *
 * Path resolution:
 *   - env `LM_TERMINAL_LIVE_SNAPSHOT_PATH` overrides (used by tests + fixture-
 *     driven dev). Resolved per-call so tests can flip it between assertions.
 *   - default: `<repo-root>/../07_DATA/content/intelligence/terminal_assets.live.json`
 *     (the SDE materialised output, read-only per spec §4.2).
 */
import path from "path";
import { promises as fsp } from "fs";
import {
  TerminalLiveSnapshotSchema,
  type TerminalLiveSnapshot,
} from "./asset-live";

const ENV_PATH_KEY = "LM_TERMINAL_LIVE_SNAPSHOT_PATH";
const DEFAULT_RELATIVE_PATH =
  "../../07_DATA/content/intelligence/terminal_assets.live.json";

export function resolveLiveSnapshotPath(): string {
  const fromEnv = process.env[ENV_PATH_KEY];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return path.resolve(process.cwd(), DEFAULT_RELATIVE_PATH);
}

export interface LiveSnapshotReadResult {
  fileExists: boolean;
  snapshot: TerminalLiveSnapshot | null;
  mtimeMs: number | null;
  parseError: string | null;
}

export async function readTerminalLiveSnapshot(): Promise<LiveSnapshotReadResult> {
  const filePath = resolveLiveSnapshotPath();

  let stat: import("fs").Stats;
  try {
    stat = await fsp.stat(filePath);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return {
        fileExists: false,
        snapshot: null,
        mtimeMs: null,
        parseError: null,
      };
    }
    return {
      fileExists: false,
      snapshot: null,
      mtimeMs: null,
      parseError: `stat failed: ${(err as Error)?.message ?? String(err)}`,
    };
  }

  let raw: string;
  try {
    raw = await fsp.readFile(filePath, "utf-8");
  } catch (err) {
    return {
      fileExists: true,
      snapshot: null,
      mtimeMs: stat.mtimeMs,
      parseError: `read failed: ${(err as Error)?.message ?? String(err)}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      fileExists: true,
      snapshot: null,
      mtimeMs: stat.mtimeMs,
      parseError: `JSON.parse: ${(err as Error)?.message ?? String(err)}`,
    };
  }

  const result = TerminalLiveSnapshotSchema.safeParse(parsed);
  if (!result.success) {
    return {
      fileExists: true,
      snapshot: null,
      mtimeMs: stat.mtimeMs,
      parseError: `schema: ${result.error.issues.length} issue(s)`,
    };
  }

  return {
    fileExists: true,
    snapshot: result.data,
    mtimeMs: stat.mtimeMs,
    parseError: null,
  };
}
