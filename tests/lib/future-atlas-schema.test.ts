import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AtlasConfigSchema,
  ContractSchema,
  ForecastEventSchema,
  ManifestSchema,
  loadContracts,
} from "@/lib/future-atlas/schema";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "future-atlas");
const CONTENT_DIR = path.join(process.cwd(), "content", "future-atlas");

const readFixture = <T>(name: string): T =>
  JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8")) as T;

const validConfig = readFixture<Record<string, unknown>>("config.valid.json");
const validManifest = readFixture<Record<string, unknown>>("manifest.valid.json");
const validContract = readFixture<Record<string, unknown>>("contract.valid.json");
const validEvents = readFixture<Record<string, unknown>[]>("events.valid.json");

describe("Future Atlas schema layer", () => {
  it("keeps the initial content ledger empty and parseable", () => {
    expect(JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "config.json"), "utf8"))).toEqual(validConfig);
    expect(JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "manifest.json"), "utf8"))).toEqual({
      schemaVersion: 1,
      themes: [],
      entries: [],
    });
    expect(fs.statSync(path.join(CONTENT_DIR, "events.jsonl")).size).toBe(0);
    expect(fs.statSync(path.join(CONTENT_DIR, "contracts", ".gitkeep")).size).toBe(0);
    expect(AtlasConfigSchema.parse(validConfig)).toEqual(validConfig);
    expect(ManifestSchema.parse(validManifest)).toEqual(validManifest);
    expect(ContractSchema.parse(validContract)).toEqual(validContract);
    for (const event of validEvents) expect(ForecastEventSchema.parse(event)).toEqual(event);
  });

  it("rejects unknown config fields (guard #14)", () => {
    expect(() => AtlasConfigSchema.parse({ ...validConfig, extra: true })).toThrow();
  });

  it("rejects dueAt not after publishedAtJst (guard #9)", () => {
    expect(() => ContractSchema.parse({ ...validContract, dueAt: "2026-07-17" })).toThrow(/dueAt/);
  });

  it("rejects dueAt more than 3 years out (guard #10)", () => {
    expect(() => ContractSchema.parse({ ...validContract, dueAt: "2029-07-18" })).toThrow(/3 year/);
  });

  it("rejects evidenceCutoff after publishedAtJst (guard #15)", () => {
    expect(() => ContractSchema.parse({ ...validContract, evidenceCutoff: "2026-07-18" })).toThrow(/evidenceCutoff/);
  });

  it("rejects unknown contract keys including numeric probability (guard #14)", () => {
    expect(() => ContractSchema.parse({ ...validContract, probability: 0.7 })).toThrow();
  });

  it("rejects impossible calendar dates and clock values", () => {
    expect(() => ContractSchema.parse({ ...validContract, dueAt: "2027-02-31" })).toThrow(/real calendar/);
    expect(() => ContractSchema.parse({ ...validContract, dueAt: "2026-13-01" })).toThrow(/real calendar/);
    expect(() => ContractSchema.parse({ ...validContract, publishedAtJst: "2026-07-17T24:60:00+09:00" })).toThrow(/real JST/);
  });

  it("clamps the 3-year bound across leap-day boundaries", () => {
    const leap = {
      ...validContract,
      publishedAtJst: "2028-02-29T09:00+09:00",
      evidenceCutoff: "2028-02-28",
    };
    expect(() => ContractSchema.parse({ ...leap, dueAt: "2031-02-28" })).not.toThrow();
    expect(() => ContractSchema.parse({ ...leap, dueAt: "2031-03-01" })).toThrow(/3 year/);
  });

  it("rejects duplicate forecastId across contracts (guard #1)", () => {
    expect(() => loadContracts([validContract, validContract])).toThrow(/duplicate forecastId/);
  });

  it("rejects vision without human_written (guard #20)", () => {
    expect(() => ManifestSchema.parse({
      schemaVersion: 1,
      themes: [{ key: "ai", titleJa: "AI", order: 0 }],
      entries: [{
        articleId: "future-map-a",
        kind: "vision",
        themes: ["ai"],
        atlasPlacement: 0,
        relatedArticleIds: [],
        authorDisplay: "田平茂樹",
        authorshipMode: "ai_draft_human_edited",
      }],
    })).toThrow(/human_written/);
  });

  it("rejects manifest date fields", () => {
    expect(() => ManifestSchema.parse({
      schemaVersion: 1,
      themes: [{ key: "ai", titleJa: "AI", order: 0 }],
      entries: [{
        articleId: "future-map-a",
        kind: "forecast",
        themes: ["ai"],
        atlasPlacement: 0,
        relatedArticleIds: [],
        authorDisplay: "田平茂樹",
        authorshipMode: "human_written",
        publishedAtJst: "2026-07-17T09:00:00+09:00",
      }],
    })).toThrow();
  });

  it("rejects duplicate manifest identities and unknown themes", () => {
    const duplicated = structuredClone(validManifest);
    const entries = duplicated.entries as Record<string, unknown>[];
    entries.push({ ...entries[0] });
    expect(() => ManifestSchema.parse(duplicated)).toThrow(/duplicate articleId/);
    expect(() => ManifestSchema.parse({
      ...validManifest,
      entries: [{ ...(validManifest.entries as Record<string, unknown>[])[0], themes: ["missing"] }],
    })).toThrow(/unknown theme key/);
  });

  it("rejects true or false resolutions without article evidence (guard #8)", () => {
    expect(() => ForecastEventSchema.parse({
      ...validEvents[0], articleId: undefined, materials: [],
    })).toThrow(/articleId \+ materials/);
  });

  it("rejects indeterminate or void resolutions without rationale, evidence, and independent review (guard #8)", () => {
    expect(() => ForecastEventSchema.parse({
      ...validEvents[0],
      resolutionStatus: "indeterminate",
      note: undefined,
      secondReview: undefined,
      materials: [],
    })).toThrow(/reason \+ materials \+ secondReview/);
  });

  it("rejects a second reviewer who is also the decider (guard #8)", () => {
    expect(() => ForecastEventSchema.parse({
      ...validEvents[0],
      secondReview: {
        reviewer: "tabira",
        reviewedAt: "2027-06-30",
        reviewDecision: "agree",
        reviewNote: "確認済み",
      },
    })).toThrow(/must differ/);
  });

  it("rejects resolution corrections without material evidence (guard #19)", () => {
    expect(() => ForecastEventSchema.parse({
      type: "resolution_correction",
      eventId: "ev-correction",
      date: "2027-07-01",
      forecastId: "fc-example-1",
      materials: [],
      supersedesEventId: "ev-example-resolution",
      resolutionStatus: "false",
      reason: "訂正",
      correctionArticleId: "future-map-correction",
      decidedBy: "tabira",
      secondReview: {
        reviewer: "reviewer",
        reviewedAt: "2027-07-01",
        reviewDecision: "agree",
        reviewNote: "確認済み",
      },
      correctedAt: "2027-07-01",
    })).toThrow();
  });

  it("rejects metadata correction values that do not match the selected field type (guard #17)", () => {
    const base = {
      type: "metadata_correction",
      eventId: "ev-m1",
      date: "2026-07-18",
      articleId: "future-map-a",
      reason: "棚移動",
      materials: [],
    };
    expect(() => ForecastEventSchema.parse({ ...base, field: "themes", before: "ai", after: ["ai", "finance"] })).toThrow(/value type/);
    expect(() => ForecastEventSchema.parse({ ...base, field: "atlasPlacement", before: 0, after: "1" })).toThrow(/value type/);
    expect(() => ForecastEventSchema.parse({ ...base, field: "themes", before: ["ai"], after: ["ai", "finance"] })).not.toThrow();
  });
});
