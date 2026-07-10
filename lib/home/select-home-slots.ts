import type {
  ArticleLane,
  ArticleMeta,
} from "@/lib/articles/article-model";
import type { SessionRecord } from "@/lib/sessions/session-content";
import type { RadarObservation } from "./radar-observations";

export interface HomeSlotInput {
  articles: ArticleMeta[];
  sessions: SessionRecord[];
  radar: readonly RadarObservation[];
  promotions: Readonly<Record<string, string>>;
  today: string;
}

export type LeadState = "today" | "latest" | "pending";

export interface HomeSlots {
  lead: {
    state: LeadState;
    article: ArticleMeta | null;
    previous: ArticleMeta | null;
  };
  mkt12: {
    state: "published" | "awaiting";
    article: ArticleMeta | null;
    previous: ArticleMeta | null;
    weekend: ArticleMeta | null;
    archive: ArticleMeta[];
  };
  radarPair: {
    observation: RadarObservation;
    article: ArticleMeta;
  } | null;
  observing: RadarObservation[];
  recentSignals: ArticleMeta[];
  lanes: { lane: ArticleLane; articles: ArticleMeta[] }[];
  library: ArticleMeta[];
}

const dateOf = (article: ArticleMeta): string =>
  article.publishedAtJst.slice(0, 10);

export function normalizeHomeInput(input: HomeSlotInput): HomeSlotInput {
  return {
    ...input,
    articles: input.articles.filter((article) => dateOf(article) <= input.today),
    sessions: input.sessions.map((session) =>
      session.liveStatus === "live" && session.date !== input.today
        ? { ...session, liveStatus: "closed" as const }
        : session,
    ),
  };
}

export function selectHomeSlots(rawInput: HomeSlotInput): HomeSlots {
  const input = normalizeHomeInput(rawInput);
  const used = new Set<string>();
  const take = (article: ArticleMeta | undefined): ArticleMeta | undefined => {
    if (article) {
      used.add(article.articleId);
    }
    return article;
  };
  const unused = (article: ArticleMeta): boolean =>
    !used.has(article.articleId);

  const dailyIntel = input.articles.filter(
    (article) => article.family === "daily-intel",
  );
  const todayIntel = dailyIntel.find(
    (article) => dateOf(article) === input.today,
  );
  const lead: HomeSlots["lead"] = todayIntel
    ? { state: "today", article: take(todayIntel) ?? null, previous: null }
    : dailyIntel[0]
      ? {
          state: "latest",
          article: take(dailyIntel[0]) ?? null,
          previous: null,
        }
      : { state: "pending", article: null, previous: null };

  const mornings = input.articles.filter(
    (article) => article.family === "mkt12-morning",
  );
  const todayMorning = mornings.find(
    (article) => (article.dataDate ?? dateOf(article)) === input.today,
  );
  const previousMornings = mornings.filter(
    (article) => article !== todayMorning,
  );
  const previous = todayMorning ? null : (previousMornings[0] ?? null);
  const mkt12: HomeSlots["mkt12"] = {
    state: todayMorning ? "published" : "awaiting",
    article: take(todayMorning) ?? null,
    previous,
    weekend:
      take(
        input.articles.find(
          (article) =>
            article.family === "mkt12-weekend" && unused(article),
        ),
      ) ?? null,
    archive: previousMornings
      .filter((article) => unused(article) && article !== previous)
      .slice(0, 2)
      .map((article) => take(article) as ArticleMeta),
  };

  const promotionCandidates = input.radar
    .filter((observation) => input.promotions[observation.topicId])
    .toSorted((left, right) =>
      right.observedAtLabel.localeCompare(left.observedAtLabel),
    );
  let radarPair: HomeSlots["radarPair"] = null;
  for (const observation of promotionCandidates) {
    const article = input.articles.find(
      (candidate) =>
        candidate.articleId === input.promotions[observation.topicId] &&
        candidate.radarTopicId === observation.topicId,
    );
    if (article) {
      radarPair = {
        observation,
        article: take(article) as ArticleMeta,
      };
      break;
    }
  }
  const observing = input.radar.filter(
    (observation) => observation !== radarPair?.observation,
  );
  const recentSignals = input.articles
    .filter((article) => article.family === "signal" && unused(article))
    .slice(0, 2)
    .map((article) => take(article) as ArticleMeta);

  const lanes = (["macro", "crypto", "rwa"] as const).map((lane) => ({
    lane,
    articles: input.articles
      .filter((article) => article.lanes.includes(lane) && unused(article))
      .slice(0, 2)
      .map((article) => take(article) as ArticleMeta),
  }));

  const shownFamilies = new Set(
    input.articles
      .filter((article) => used.has(article.articleId))
      .map((article) => article.family),
  );
  const unseenFamilies = input.articles.filter(
    (article) => unused(article) && !shownFamilies.has(article.family),
  );
  const fill = input.articles.filter(unused);
  const library = [...unseenFamilies, ...fill]
    .filter(
      (article, index, articles) =>
        articles.findIndex(
          (candidate) => candidate.articleId === article.articleId,
        ) === index,
    )
    .slice(0, 3)
    .map((article) => take(article) as ArticleMeta);

  return {
    lead,
    mkt12,
    radarPair,
    observing,
    recentSignals,
    lanes,
    library,
  };
}

export function collectSelectedArticleIds(slots: HomeSlots): string[] {
  return [
    ...(slots.lead.article ? [slots.lead.article.articleId] : []),
    ...(slots.mkt12.article ? [slots.mkt12.article.articleId] : []),
    ...(slots.mkt12.weekend ? [slots.mkt12.weekend.articleId] : []),
    ...slots.mkt12.archive.map((article) => article.articleId),
    ...(slots.radarPair ? [slots.radarPair.article.articleId] : []),
    ...slots.recentSignals.map((article) => article.articleId),
    ...slots.lanes.flatMap((lane) =>
      lane.articles.map((article) => article.articleId),
    ),
    ...slots.library.map((article) => article.articleId),
  ];
}
