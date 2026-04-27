/**
 * Terminal v2 — snapshot reader.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §2
 *
 * Reads `terminal_assets.json` (SDE-builder-produced or fixture during v0)
 * and returns a parsed `TerminalAssetsSnapshot`. Honours degrade contract:
 *   - file absent      → fileExists=false, snapshot=null, parseError=null
 *   - file present BUT JSON malformed or schema-violating → fileExists=true,
 *     snapshot=null, parseError set
 *   - file present + valid JSON + schema OK → snapshot populated
 *
 * Reading from `07_DATA/content/intelligence/terminal_assets.json` is the
 * production wiring. Tests / fixture-driven dev pass `LM_TERMINAL_SNAPSHOT_PATH`
 * to point at the fixture. The path is resolved per-call so env overrides
 * during the same process are honoured.
 */
import path from "path";
import { promises as fsp } from "fs";
import {
  TerminalAssetsSnapshotSchema,
  type TerminalAssetsSnapshot,
} from "./asset-summary";

const ENV_PATH_KEY = "LM_TERMINAL_SNAPSHOT_PATH";
const DEFAULT_RELATIVE_PATH =
  "../../07_DATA/content/intelligence/terminal_assets.json";

export function resolveSnapshotPath(): string {
  const fromEnv = process.env[ENV_PATH_KEY];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  // Default: walk up from app cwd to repo root, then into 07_DATA.
  // process.cwd() at runtime is the livemakers-site repo root.
  return path.resolve(process.cwd(), DEFAULT_RELATIVE_PATH);
}

export interface SnapshotReadResult {
  fileExists: boolean;
  snapshot: TerminalAssetsSnapshot | null;
  mtimeMs: number | null;
  parseError: string | null;
}

export async function readTerminalAssetsSnapshot(): Promise<SnapshotReadResult> {
  const filePath = resolveSnapshotPath();

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
    // Other I/O errors (permissions etc.) — treat as missing for degrade,
    // but record reason so callers/logs can surface it if needed.
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

  const result = TerminalAssetsSnapshotSchema.safeParse(parsed);
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
