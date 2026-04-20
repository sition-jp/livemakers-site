import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";

async function callRoute(): Promise<{
  status: number;
  body: any;
  headers: Headers;
}> {
  vi.resetModules();
  const mod = await import("@/app/api/intents/route");
  const req = new NextRequest("http://localhost/api/intents");
  const res = await mod.GET(req);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body, headers: res.headers };
}

describe("GET /api/intents", () => {
  let tmpDir: string;
  let jsonlPath: string;
  const origEnv = process.env.LM_INTENTS_JSONL_PATH;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lm-intents-api-"));
    jsonlPath = path.join(tmpDir, "tradeintents.jsonl");
    process.env.LM_INTENTS_JSONL_PATH = jsonlPath;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (origEnv === undefined) delete process.env.LM_INTENTS_JSONL_PATH;
    else process.env.LM_INTENTS_JSONL_PATH = origEnv;
  });

  function sampleIntentLine(overrides: Record<string, unknown> = {}): string {
    return (
      JSON.stringify({
        intent_id: "int_0000000000000001",
        trace_id: "00000000-0000-4000-8000-000000000001",
        schema_version: "0.1-alpha",
        created_at: "2026-04-20T09:00:00Z",
        updated_at: "2026-04-20T09:00:00Z",
        status: "approved",
        source_signal_ids: ["sig_001"],
        title: "T",
        description: "D",
        side: "accumulate",
        target_assets: ["ADA"],
        thesis: "Thesis long enough to pass validation.",
        why_now: "Why now reason sufficiently long.",
        invalidation_thesis: "Cancel if BTC weekly close < $55k.",
        thesis_conviction: 0.7,
        execution_confidence: 0.5,
        priority: 0.5,
        preferred_horizon: "swing",
        portfolio_context: { bucket: "tactical" },
        human_review: {
          required: true,
          approved_by: "LiveMakers Terminal",
          approved_at: "2026-04-20T09:00:00Z",
        },
        display: {
          headline_en: "E",
          headline_ja: "J",
          summary_en: "Summary long enough to pass.",
          summary_ja: "十分長い要約の日本語サンプル文字列です。これでバリデーション通過。",
        },
        visibility: "public",
        authored_via: "claude_code_dialogue",
        ...overrides,
      }) + "\n"
    );
  }

  it("R1-1: returns 200 + empty list when file missing", async () => {
    const { status, body } = await callRoute();
    expect(status).toBe(200);
    expect(body.intents).toEqual([]);
    expect(body.meta.count).toBe(0);
    expect(body.meta.source_freshness_sec).toBe(-1);
  });

  it("R1-2: returns intents from jsonl ordered by updated_at desc", async () => {
    fs.writeFileSync(
      jsonlPath,
      sampleIntentLine({
        intent_id: "int_0000000000000001",
        updated_at: "2026-04-20T09:00:00Z",
      }) +
        sampleIntentLine({
          intent_id: "int_0000000000000002",
          trace_id: "00000000-0000-4000-8000-000000000002",
          updated_at: "2026-04-20T11:00:00Z",
        }),
    );
    const { status, body } = await callRoute();
    expect(status).toBe(200);
    expect(body.intents).toHaveLength(2);
    expect(body.intents[0].intent_id).toBe("int_0000000000000002");
    expect(body.intents[1].intent_id).toBe("int_0000000000000001");
  });

  it("R1-3: filters visibility=private out of results", async () => {
    fs.writeFileSync(
      jsonlPath,
      sampleIntentLine({ visibility: "private" }) +
        sampleIntentLine({
          intent_id: "int_0000000000000002",
          trace_id: "00000000-0000-4000-8000-000000000002",
        }),
    );
    const { body } = await callRoute();
    expect(body.intents).toHaveLength(1);
    expect(body.intents[0].intent_id).toBe("int_0000000000000002");
  });

  it("R1-4: emits ETag header keyed to mtime", async () => {
    fs.writeFileSync(jsonlPath, sampleIntentLine());
    const { headers } = await callRoute();
    const etag = headers.get("etag");
    expect(etag).toMatch(/^W\/"intents-list-\d+"$/);
  });

  it("R1-5: If-None-Match match returns 304 without body", async () => {
    fs.writeFileSync(jsonlPath, sampleIntentLine());
    const first = await callRoute();
    const etag = first.headers.get("etag") ?? "";
    vi.resetModules();
    const mod = await import("@/app/api/intents/route");
    const req = new NextRequest("http://localhost/api/intents", {
      headers: { "if-none-match": etag },
    });
    const res = await mod.GET(req);
    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe(etag);
  });

  it("R1-6: Cache-Control public max-age 30 / s-maxage 60 / swr 120", async () => {
    fs.writeFileSync(jsonlPath, sampleIntentLine());
    const { headers } = await callRoute();
    const cc = headers.get("cache-control") ?? "";
    expect(cc).toContain("public");
    expect(cc).toContain("max-age=30");
    expect(cc).toContain("s-maxage=60");
    expect(cc).toContain("stale-while-revalidate=120");
  });

  it("R1-7: 503 when reader throws I/O error", async () => {
    const badPath = "/this/path/does/not/have/a/dir/tradeintents.jsonl";
    // Simulate EIO by pointing to a path whose parent does not exist AND
    // forcing existsSync to lie — easier: point env at a file whose parent
    // IS a file (causing read attempt to throw).
    const fakeFile = path.join(tmpDir, "notadir");
    fs.writeFileSync(fakeFile, "blocker");
    process.env.LM_INTENTS_JSONL_PATH = path.join(fakeFile, "tradeintents.jsonl");
    const { status, body } = await callRoute();
    expect(status).toBe(503);
    expect(body.error).toMatch(/unavailable/i);
  });

  it("R1-8: returns TradeIntentSummary shape (no full thesis body)", async () => {
    fs.writeFileSync(jsonlPath, sampleIntentLine());
    const { body } = await callRoute();
    const summary = body.intents[0];
    expect(summary).toHaveProperty("intent_id");
    expect(summary).toHaveProperty("display");
    expect(summary).toHaveProperty("source_signal_ids");
    expect(summary.thesis).toBeUndefined();
    expect(summary.invalidation_thesis).toBeUndefined();
  });
});
