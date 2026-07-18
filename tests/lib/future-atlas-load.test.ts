import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadFutureAtlas } from "@/lib/future-atlas/load";

type Fixture = {
  root: string;
  atlasDir: string;
  articlesDir: string;
  manifest: {
    schemaVersion: 1;
    themes: Array<{ key: string; titleJa: string; order: number }>;
    entries: Array<{
      articleId: string;
      kind: "vision" | "structural_report" | "forecast";
      themes: string[];
      atlasPlacement: number;
      relatedArticleIds: string[];
      authorDisplay: string;
      authorshipMode: "human_written" | "ai_draft_human_edited";
    }>;
  };
};

const temporaryRoots: string[] = [];

const writeJson = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const articleMeta = (
  articleId: string,
  publishedAtJst = "2026-07-17T09:00:00+09:00",
  family = "future-map",
) => ({
  articleId,
  family,
  titleJa: articleId,
  publishedAtJst,
  publishedLabel: "07-17 09:00 公開",
  lanes: [],
});

const contract = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  forecastId: "fc-a",
  claim: "検証可能な主張",
  evidenceCutoff: "2026-07-16",
  publishedAtJst: "2026-07-17T09:00:00+09:00",
  dueAt: "2027-07-17",
  resolutionCriteria: "公式発表で判定する",
  resolutionSources: ["公式発表"],
  confidence: "base_case",
  articleId: "future-map-a",
  authorId: "tabira",
  ...overrides,
});

const createFixture = (): Fixture => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lmk-future-atlas-load-"));
  temporaryRoots.push(root);
  const atlasDir = path.join(root, "future-atlas");
  const articlesDir = path.join(root, "articles");
  const manifest: Fixture["manifest"] = {
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
    }],
  };

  writeJson(path.join(atlasDir, "config.json"), { schemaVersion: 1, surfacePublished: false });
  writeJson(path.join(atlasDir, "manifest.json"), manifest);
  writeJson(path.join(atlasDir, "contracts", "fc-a.json"), contract());
  fs.writeFileSync(path.join(atlasDir, "events.jsonl"), "");
  writeJson(path.join(articlesDir, "future-map-a", "meta.json"), articleMeta("future-map-a"));

  return { root, atlasDir, articlesDir, manifest };
};

const load = (fixture: Fixture) => loadFutureAtlas({
  futureAtlasDir: fixture.atlasDir,
  articleContentDir: fixture.articlesDir,
});

const writeEvents = (fixture: Fixture, events: unknown[]) => {
  fs.writeFileSync(
    path.join(fixture.atlasDir, "events.jsonl"),
    events.map((event) => JSON.stringify(event)).join("\n") + (events.length > 0 ? "\n" : ""),
  );
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("Future Atlas content loader", () => {
  it("validates the repository content through schemas, cross-store checks, and replay", async () => {
    const data = await loadFutureAtlas();

    expect(data.config.schemaVersion).toBe(1);
    expect(data.states.size).toBe(data.contracts.length);
    for (const contractItem of data.contracts) {
      expect(data.states.get(contractItem.forecastId)?.forecastId).toBe(contractItem.forecastId);
    }
  });

  it("loads contracts, articles, and replayed states from an injected content root", async () => {
    const fixture = createFixture();

    const data = await load(fixture);

    expect(data.config.surfacePublished).toBe(false);
    expect(data.contracts.map((item) => item.forecastId)).toEqual(["fc-a"]);
    expect(data.articles.get("future-map-a")?.family).toBe("future-map");
    expect(data.states.get("fc-a")?.resolutionStatus).toBe("open");
  });

  it("returns an empty ledger when content/future-atlas does not exist", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lmk-future-atlas-missing-"));
    temporaryRoots.push(root);

    const data = await loadFutureAtlas({
      futureAtlasDir: path.join(root, "missing"),
      articleContentDir: path.join(root, "articles"),
    });

    expect(data).toMatchObject({
      config: { schemaVersion: 1, surfacePublished: false },
      manifest: { schemaVersion: 1, themes: [], entries: [] },
      contracts: [],
    });
    expect(data.states.size).toBe(0);
    expect(data.articles.size).toBe(0);
  });

  it("rejects manifest articleIds that do not exist", async () => {
    const fixture = createFixture();
    fs.rmSync(path.join(fixture.articlesDir, "future-map-a"), { recursive: true });

    await expect(load(fixture)).rejects.toThrow(/manifest articleId.*future-map-a.*not found/i);
  });

  it("requires every manifest article to use the future-map family", async () => {
    const fixture = createFixture();
    writeJson(
      path.join(fixture.articlesDir, "future-map-a", "meta.json"),
      articleMeta("future-map-a", undefined, "deep-dive"),
    );

    await expect(load(fixture)).rejects.toThrow(/family.*future-map/i);
  });

  it("requires every relatedArticleId to resolve to an article", async () => {
    const fixture = createFixture();
    fixture.manifest.entries[0].relatedArticleIds = ["missing-related"];
    writeJson(path.join(fixture.atlasDir, "manifest.json"), fixture.manifest);

    await expect(load(fixture)).rejects.toThrow(/relatedArticleId.*missing-related.*not found/i);
  });

  it("requires each forecast manifest entry to have at least one contract", async () => {
    const fixture = createFixture();
    fs.rmSync(path.join(fixture.atlasDir, "contracts", "fc-a.json"));

    await expect(load(fixture)).rejects.toThrow(/forecast article.*future-map-a.*contract/i);
  });

  it("requires every contract article to resolve to a forecast manifest entry", async () => {
    const fixture = createFixture();
    fixture.manifest.entries[0].kind = "vision";
    writeJson(path.join(fixture.atlasDir, "manifest.json"), fixture.manifest);

    await expect(load(fixture)).rejects.toThrow(/contract.*fc-a.*forecast manifest/i);
  });

  it("requires contract and ArticleMeta publishedAtJst to match", async () => {
    const fixture = createFixture();
    writeJson(
      path.join(fixture.articlesDir, "future-map-a", "meta.json"),
      articleMeta("future-map-a", "2026-07-17T10:00:00+09:00"),
    );

    await expect(load(fixture)).rejects.toThrow(/publishedAtJst.*match/i);
  });

  it("requires a contract filename to equal its forecastId", async () => {
    const fixture = createFixture();
    fs.renameSync(
      path.join(fixture.atlasDir, "contracts", "fc-a.json"),
      path.join(fixture.atlasDir, "contracts", "wrong-name.json"),
    );

    await expect(load(fixture)).rejects.toThrow(/filename.*fc-a\.json/i);
  });

  it("rejects duplicate forecastIds across contract files", async () => {
    const fixture = createFixture();
    writeJson(path.join(fixture.atlasDir, "contracts", "fc-duplicate.json"), contract());

    await expect(load(fixture)).rejects.toThrow(/duplicate forecastId/i);
  });

  it("requires every event forecastId to resolve to a contract", async () => {
    const fixture = createFixture();
    writeEvents(fixture, [{
      type: "evidence_added",
      eventId: "ev-missing-contract",
      date: "2026-07-18",
      forecastId: "fc-missing",
      materials: [],
    }]);

    await expect(load(fixture)).rejects.toThrow(/event forecastId.*fc-missing.*contract/i);
  });

  it("requires every event articleId to resolve to an article", async () => {
    const fixture = createFixture();
    writeEvents(fixture, [{
      type: "evidence_added",
      eventId: "ev-missing-article",
      date: "2026-07-18",
      forecastId: "fc-a",
      articleId: "missing-article",
      materials: [],
    }]);

    await expect(load(fixture)).rejects.toThrow(/event articleId.*missing-article.*not found/i);
  });

  it("requires correctionArticleId to resolve to an article", async () => {
    const fixture = createFixture();
    writeEvents(fixture, [{
      type: "resolution",
      eventId: "ev-resolution",
      date: "2027-07-17",
      forecastId: "fc-a",
      articleId: "future-map-a",
      materials: ["公式発表"],
      resolutionStatus: "true",
      decidedBy: "tabira",
    }, {
      type: "resolution_correction",
      eventId: "ev-correction",
      date: "2027-07-18",
      forecastId: "fc-a",
      materials: ["公式発表"],
      supersedesEventId: "ev-resolution",
      resolutionStatus: "false",
      reason: "訂正",
      correctionArticleId: "missing-correction-article",
      decidedBy: "tabira",
      secondReview: {
        reviewer: "reviewer",
        reviewedAt: "2027-07-18",
        reviewDecision: "agree",
        reviewNote: "確認済み",
      },
      correctedAt: "2027-07-18",
    }]);

    await expect(load(fixture)).rejects.toThrow(/correctionArticleId.*missing-correction-article/i);
  });

  it("requires supersededByForecastId to resolve to a contract", async () => {
    const fixture = createFixture();
    writeEvents(fixture, [{
      type: "update",
      eventId: "ev-update",
      date: "2026-07-18",
      forecastId: "fc-a",
      note: "後継予測を発行",
      materials: [],
      supersededByForecastId: "fc-missing",
    }]);

    await expect(load(fixture)).rejects.toThrow(/supersededByForecastId.*fc-missing/i);
  });

  it("rejects duplicate eventIds across the entire events ledger", async () => {
    const fixture = createFixture();
    writeEvents(fixture, [{
      type: "evidence_added",
      eventId: "ev-duplicate",
      date: "2026-07-18",
      forecastId: "fc-a",
      materials: [],
    }, {
      type: "endorsement_withdrawn",
      eventId: "ev-duplicate",
      date: "2026-07-19",
      forecastId: "fc-a",
      note: "撤回",
      materials: [],
    }]);

    await expect(load(fixture)).rejects.toThrow(/duplicate eventId.*ev-duplicate/i);
  });
});
