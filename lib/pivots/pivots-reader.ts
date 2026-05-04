/**
 * AI Turning Point Detector — file readers.
 *
 * Spec: docs/ai_turning_point_detector_prd.md (PRD §21)
 *
 * Mirrors the existing `lib/terminal/live-snapshot-reader.ts` shape:
 *   - env-overridable path, resolved per call (test-friendly)
 *   - ENOENT → fileExists:false, NOT throw (200 + empty pre-launch state)
 *   - read/parse/zod-validate failures populate `parseError`
 *
 * Phase 1: reads committed mock files under `data/`. Phase 2: a Python
 * producer overwrites the same files with the same shape; reader contract
 * stays unchanged.
 */
import path from "path";
import { promises as fsp } from "fs";
import {
  PivotAssetsSnapshotSchema,
  PivotBacktestSnapshotSchema,
  type PivotAssetsSnapshot,
  type PivotBacktestSnapshot,
} from "./types";

const ASSETS_ENV_KEY = "LM_PIVOT_ASSETS_PATH";
const BACKTEST_ENV_KEY = "LM_PIVOT_BACKTEST_PATH";

const DEFAULT_ASSETS_RELATIVE_PATH = "data/pivot_assets.live.json";
const DEFAULT_BACKTEST_RELATIVE_PATH = "data/pivot_backtest.live.json";

export function resolveAssetsPath(): string {
  const fromEnv = process.env[ASSETS_ENV_KEY];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return path.resolve(process.cwd(), DEFAULT_ASSETS_RELATIVE_PATH);
}

export function resolveBacktestPath(): string {
  const fromEnv = process.env[BACKTEST_ENV_KEY];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return path.resolve(process.cwd(), DEFAULT_BACKTEST_RELATIVE_PATH);
}

export interface AssetsReadResult {
  fileExists: boolean;
  snapshot: PivotAssetsSnapshot | null;
  mtimeMs: number | null;
  parseError: string | null;
}

export interface BacktestReadResult {
  fileExists: boolean;
  snapshot: PivotBacktestSnapshot | null;
  mtimeMs: number | null;
  parseError: string | null;
}

async function readJsonFile(filePath: string): Promise<
  | { ok: true; raw: unknown; mtimeMs: number }
  | { ok: false; fileExists: boolean; mtimeMs: number | null; parseError: string }
> {
  let stat: import("fs").Stats;
  try {
    stat = await fsp.stat(filePath);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return { ok: false, fileExists: false, mtimeMs: null, parseError: "" };
    }
    return {
      ok: false,
      fileExists: false,
      mtimeMs: null,
      parseError: `stat failed: ${(err as Error)?.message ?? String(err)}`,
    };
  }

  let body: string;
  try {
    body = await fsp.readFile(filePath, "utf-8");
  } catch (err) {
    return {
      ok: false,
      fileExists: true,
      mtimeMs: stat.mtimeMs,
      parseError: `read failed: ${(err as Error)?.message ?? String(err)}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    return {
      ok: false,
      fileExists: true,
      mtimeMs: stat.mtimeMs,
      parseError: `JSON.parse: ${(err as Error)?.message ?? String(err)}`,
    };
  }

  return { ok: true, raw: parsed, mtimeMs: stat.mtimeMs };
}

export async function readAssetsSnapshot(): Promise<AssetsReadResult> {
  const filePath = resolveAssetsPath();
  const r = await readJsonFile(filePath);
  if (!r.ok) {
    if (!r.fileExists && r.parseError === "") {
      return { fileExists: false, snapshot: null, mtimeMs: null, parseError: null };
    }
    return {
      fileExists: r.fileExists,
      snapshot: null,
      mtimeMs: r.mtimeMs,
      parseError: r.parseError,
    };
  }
  const result = PivotAssetsSnapshotSchema.safeParse(r.raw);
  if (!result.success) {
    return {
      fileExists: true,
      snapshot: null,
      mtimeMs: r.mtimeMs,
      parseError: `schema: ${result.error.issues.length} issue(s)`,
    };
  }
  return {
    fileExists: true,
    snapshot: result.data,
    mtimeMs: r.mtimeMs,
    parseError: null,
  };
}

export async function readBacktestSnapshot(): Promise<BacktestReadResult> {
  const filePath = resolveBacktestPath();
  const r = await readJsonFile(filePath);
  if (!r.ok) {
    if (!r.fileExists && r.parseError === "") {
      return { fileExists: false, snapshot: null, mtimeMs: null, parseError: null };
    }
    return {
      fileExists: r.fileExists,
      snapshot: null,
      mtimeMs: r.mtimeMs,
      parseError: r.parseError,
    };
  }
  const result = PivotBacktestSnapshotSchema.safeParse(r.raw);
  if (!result.success) {
    return {
      fileExists: true,
      snapshot: null,
      mtimeMs: r.mtimeMs,
      parseError: `schema: ${result.error.issues.length} issue(s)`,
    };
  }
  return {
    fileExists: true,
    snapshot: result.data,
    mtimeMs: r.mtimeMs,
    parseError: null,
  };
}
