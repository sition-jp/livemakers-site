import fs from "node:fs";
import path from "node:path";

import type { z } from "zod";

import {
  getAllArticles,
  type ArticleMeta,
} from "@/lib/articles/article-model";
import {
  replayForecast,
  type ForecastRuntimeState,
} from "@/lib/future-atlas/replay";
import {
  AtlasConfigSchema,
  ForecastEventSchema,
  ManifestSchema,
  loadContracts,
  type ForecastContract,
  type ForecastEvent,
  type Manifest,
} from "@/lib/future-atlas/schema";

type AtlasConfig = z.infer<typeof AtlasConfigSchema>;

export type FutureAtlasData = {
  config: AtlasConfig;
  manifest: Manifest;
  contracts: ForecastContract[];
  states: Map<string, ForecastRuntimeState>;
  articles: Map<string, ArticleMeta>;
};

export type FutureAtlasLoadOptions = {
  futureAtlasDir?: string;
  articleContentDir?: string;
};

const DEFAULT_FUTURE_ATLAS_DIR = path.join(process.cwd(), "content", "future-atlas");
const DEFAULT_ARTICLE_CONTENT_DIR = path.join(process.cwd(), "content", "articles");

const EMPTY_CONFIG: AtlasConfig = { schemaVersion: 1, surfacePublished: false };
const EMPTY_MANIFEST: Manifest = { schemaVersion: 1, themes: [], entries: [] };

const readJson = (filePath: string): unknown =>
  JSON.parse(fs.readFileSync(filePath, "utf8"));

const readEvents = (filePath: string): ForecastEvent[] => {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => ForecastEventSchema.parse(JSON.parse(line)));
};

const assertUniqueEventIds = (events: ForecastEvent[]) => {
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.eventId)) {
      throw new Error(`duplicate eventId in events ledger: ${event.eventId}`);
    }
    seen.add(event.eventId);
  }
};

export async function loadFutureAtlas(
  options: FutureAtlasLoadOptions = {},
): Promise<FutureAtlasData> {
  const futureAtlasDir = options.futureAtlasDir ?? DEFAULT_FUTURE_ATLAS_DIR;
  const articleContentDir = options.articleContentDir ?? DEFAULT_ARTICLE_CONTENT_DIR;
  const articles = new Map(
    getAllArticles({ contentDir: articleContentDir }).map((article) => [article.articleId, article]),
  );

  if (!fs.existsSync(futureAtlasDir)) {
    return {
      config: EMPTY_CONFIG,
      manifest: EMPTY_MANIFEST,
      contracts: [],
      states: new Map(),
      articles,
    };
  }

  const config = AtlasConfigSchema.parse(readJson(path.join(futureAtlasDir, "config.json")));
  const manifest = ManifestSchema.parse(readJson(path.join(futureAtlasDir, "manifest.json")));
  const contractsDir = path.join(futureAtlasDir, "contracts");
  const contractFiles = fs.existsSync(contractsDir)
    ? fs.readdirSync(contractsDir).filter((name) => name.endsWith(".json")).sort()
    : [];
  const contracts = loadContracts(
    contractFiles.map((name) => readJson(path.join(contractsDir, name))),
  );

  for (const [index, contractItem] of contracts.entries()) {
    const expected = `${contractItem.forecastId}.json`;
    if (contractFiles[index] !== expected) {
      throw new Error(`contract filename must equal ${expected}; got ${contractFiles[index]}`);
    }
  }

  const events = readEvents(path.join(futureAtlasDir, "events.jsonl"));
  assertUniqueEventIds(events);

  const manifestByArticleId = new Map(
    manifest.entries.map((entry) => [entry.articleId, entry]),
  );
  const contractsByForecastId = new Map(
    contracts.map((contractItem) => [contractItem.forecastId, contractItem]),
  );
  const contractsByArticleId = new Map<string, ForecastContract[]>();
  for (const contractItem of contracts) {
    const bucket = contractsByArticleId.get(contractItem.articleId) ?? [];
    bucket.push(contractItem);
    contractsByArticleId.set(contractItem.articleId, bucket);
  }

  for (const entry of manifest.entries) {
    const article = articles.get(entry.articleId);
    if (!article) {
      throw new Error(`manifest articleId ${entry.articleId} not found in content/articles`);
    }
    if (article.family !== "future-map") {
      throw new Error(`manifest article ${entry.articleId} family must be future-map`);
    }
    for (const relatedArticleId of entry.relatedArticleIds) {
      if (!articles.has(relatedArticleId)) {
        throw new Error(`relatedArticleId ${relatedArticleId} not found in content/articles`);
      }
    }
    if (entry.kind === "forecast" && (contractsByArticleId.get(entry.articleId)?.length ?? 0) === 0) {
      throw new Error(`forecast article ${entry.articleId} requires at least one contract`);
    }
  }

  for (const contractItem of contracts) {
    const article = articles.get(contractItem.articleId);
    if (!article) {
      throw new Error(`contract articleId not found in content/articles: ${contractItem.articleId}`);
    }
    const manifestEntry = manifestByArticleId.get(contractItem.articleId);
    if (!manifestEntry || manifestEntry.kind !== "forecast") {
      throw new Error(`contract ${contractItem.forecastId} requires a forecast manifest entry`);
    }
    if (contractItem.publishedAtJst !== article.publishedAtJst) {
      throw new Error(
        `contract ${contractItem.forecastId} publishedAtJst must match ArticleMeta publishedAtJst`,
      );
    }
  }

  for (const event of events) {
    if ("forecastId" in event && event.forecastId !== undefined
        && !contractsByForecastId.has(event.forecastId)) {
      throw new Error(`event forecastId ${event.forecastId} does not resolve to a contract`);
    }
    if (event.articleId !== undefined && !articles.has(event.articleId)) {
      throw new Error(`event articleId ${event.articleId} not found in content/articles`);
    }
    if (event.type === "resolution_correction" && !articles.has(event.correctionArticleId)) {
      throw new Error(
        `correctionArticleId not found in content/articles: ${event.correctionArticleId}`,
      );
    }
    if (event.type === "update" && event.supersededByForecastId !== undefined
        && !contractsByForecastId.has(event.supersededByForecastId)) {
      throw new Error(
        `supersededByForecastId does not resolve to a contract: ${event.supersededByForecastId}`,
      );
    }
  }

  const states = new Map(
    contracts.map((contractItem) => [
      contractItem.forecastId,
      replayForecast(contractItem.forecastId, events),
    ]),
  );

  return { config, manifest, contracts, states, articles };
}
