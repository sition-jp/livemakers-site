import type { ArticleMeta } from "@/lib/articles/article-model";
import type { SessionRecord } from "@/lib/sessions/session-content";
import type { RadarObservation } from "./radar-observations";
import { selectSignalTimeline } from "./select-signal-timeline";

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
  signalTimeline: ArticleMeta[];
  deepDives: ArticleMeta[];
  latestArticles: ArticleMeta[];
  eventRiskLatest: ArticleMeta | null;
  atlasLatest: ArticleMeta | null;
  mkt12WeekendLatest: ArticleMeta | null;
  weeklyBriefLatest: ArticleMeta | null;
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
  // now は builder input に無いので input.today の JST end-of-day から決定的に導出する
  // (buildHomeCompositionProps の入力契約を変えないための D13 制約)。
  const now = new Date(`${input.today}T23:59:59+09:00`);
  // D5 対称契約: 昇格ペアが存在し記事リンクを描くときに限り、その Signal を時系列から除外する。
  const excludeIds = radarPair ? [radarPair.article.articleId] : [];
  const signalTimeline = selectSignalTimeline({
    articles: input.articles,
    now,
    floor: 10,
    excludeIds,
  }).map((article) => take(article) as ArticleMeta);

  // input.articles は today-gate 済み・publishedAtJst 降順 (getAllArticles / normalizeHomeInput)
  // だが、以降の選定は順序前提を明示するため自前で降順ソートしてから切り出す。
  const catalog = input.articles.toSorted((left, right) =>
    right.publishedAtJst.localeCompare(left.publishedAtJst),
  );
  const latestOf = (family: ArticleMeta["family"]): ArticleMeta | null =>
    catalog.find((article) => article.family === family) ?? null;

  const deepDives = catalog
    .filter((article) => article.family === "deep-dive")
    .slice(0, 5);
  // D7: featured (先頭) のみ本体扱い。deepDives[1..] は索引意味論なので used に加えない。
  take(deepDives[0]);

  // 索引意味論スロット (used に加えない・本体記事の再掲を許す): latestArticles /
  // atlasLatest / mkt12WeekendLatest / weeklyBriefLatest。
  const latestArticles = catalog.slice(0, 10);
  const eventRiskLatest = take(latestOf("event-risk-radar") ?? undefined) ?? null;
  const atlasLatest = latestOf("future-map");
  const mkt12WeekendLatest = latestOf("mkt12-weekend");
  const weeklyBriefLatest = latestOf("weekly-brief");

  return {
    lead,
    mkt12,
    radarPair,
    observing,
    signalTimeline,
    deepDives,
    latestArticles,
    eventRiskLatest,
    atlasLatest,
    mkt12WeekendLatest,
    weeklyBriefLatest,
  };
}

/**
 * 本体 (body) スロットの articleId のみを返す (gate 6 の重複検査対象)。
 * 索引意味論スロット (deepDives[1..] / latestArticles / atlasLatest /
 * mkt12WeekendLatest / weeklyBriefLatest) は data-index-nav 扱いで
 * 本体記事の再掲を許すため、ここには含めない (D7 索引意味論)。
 */
export function collectSelectedArticleIds(slots: HomeSlots): string[] {
  return [
    ...(slots.lead.article ? [slots.lead.article.articleId] : []),
    ...(slots.mkt12.article ? [slots.mkt12.article.articleId] : []),
    ...(slots.mkt12.weekend ? [slots.mkt12.weekend.articleId] : []),
    ...slots.mkt12.archive.map((article) => article.articleId),
    ...(slots.radarPair ? [slots.radarPair.article.articleId] : []),
    ...slots.signalTimeline.map((article) => article.articleId),
    ...slots.deepDives.slice(0, 1).map((article) => article.articleId),
    ...(slots.eventRiskLatest ? [slots.eventRiskLatest.articleId] : []),
  ];
}
