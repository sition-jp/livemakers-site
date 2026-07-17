import type {
  TerminalArticleNewsFeedItem,
  TerminalPreviewPublicTopology,
  TerminalSourceFeedItem,
} from "./types";
import { breakingRadarManualLinkNoteItems } from "./breaking-radar-manual-link-notes";
import { validateBreakingRadarTitleWindow } from "./breaking-radar-title-window";

const allowedPublishedArticleRoutes = [
  /^\/brief\/[A-Za-z0-9-]+$/,
  /^\/signals\/[A-Za-z0-9_-]+$/,
  /^\/articles\/[a-z0-9-]+$/,
  /^\/articles\/today$/,
  /^\/articles\/series\/(daily-intel|signal|deep-dive|future-map|mkt12-morning|mkt12-weekend|event-risk-radar|weekly-brief)$/,
  /^\/sessions\/\d{4}-\d{2}-\d{2}-(asia-open|europe-bridge|ny-open|global-close)$/,
  /^\/sessions\/archive$/,
  /^\/future-atlas$/,
  /^\/future-atlas\/(ledger|methodology)$/,
];

export const PAGE_CHROME_ROUTES = [
  "/",
  "/about",
  "/brief",
  "/articles/today",
  "/sessions/archive",
  "/future-atlas",
  "/future-atlas/ledger",
  "/future-atlas/methodology",
] as const;

const forbiddenHrefText = [
  "terminal-preview",
  "site_publish_log",
  "published_log",
  "publish_audit",
  "publish_candidates",
  "07_DATA",
  "operator",
  "draft",
  "review-packet",
  "article_queue",
  "file://",
  "/Users/",
  "../",
  "http://",
  "https://",
];

const sourceItemWhitelist = [
  "id",
  "title",
  "sourceDomain",
  "category",
  "freshnessLabel",
];

const sourceUrlPattern =
  /(?:https?:\/\/|www\.)\S+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/\S*)?/gi;
const sourceHandlePattern = /(?<![A-Za-z0-9_@.])@[A-Za-z0-9_]{2,30}\b/g;

export function isAllowedPublishedArticleRoute(href: string): boolean {
  if (href.includes("..") || href.startsWith("/ja/")) {
    return false;
  }
  return allowedPublishedArticleRoutes.some((pattern) => pattern.test(href));
}

export function isAllowedChromeRoute(href: string): boolean {
  return (PAGE_CHROME_ROUTES as readonly string[]).includes(href);
}

function validateArticleFeedItem(
  item: TerminalArticleNewsFeedItem,
  index: number,
): string[] {
  const errors: string[] = [];

  if (!isAllowedPublishedArticleRoute(item.href)) {
    errors.push(
      `articleNewsFeed.items[${index}].href is not an allowed published article route: ${item.href}`,
    );
  }

  for (const forbidden of forbiddenHrefText) {
    if (forbidden === "terminal-preview" && item.href === "/terminal-preview") {
      continue;
    }

    if (forbidden === "/Users/" && item.href.startsWith("file:///")) {
      continue;
    }

    if (item.href.includes(forbidden)) {
      errors.push(
        `articleNewsFeed.items[${index}].href contains forbidden internal text: ${forbidden}`,
      );
    }
  }

  return errors;
}

function validateSourceTitle(
  title: TerminalSourceFeedItem["title"],
  index: number,
): string[] {
  const errors: string[] = [];
  for (const locale of ["en", "ja"] as const) {
    const value = title[locale];
    validateVisibleSourceText(
      value,
      `source.items[${index}].title.${locale}`,
      errors,
    );
    for (const match of [
      ...value.matchAll(sourceUrlPattern),
      ...value.matchAll(sourceHandlePattern),
    ]) {
      errors.push(
        `source.items[${index}].title.${locale} contains URL/handle pattern: ${match[0]}`,
      );
    }
  }
  return errors;
}

function validateVisibleSourceText(
  value: string,
  label: string,
  errors: string[],
): void {
  for (const forbidden of forbiddenHrefText) {
    if (value.includes(forbidden)) {
      errors.push(`${label} contains forbidden internal text: ${forbidden}`);
    }
  }
}

function validateSourceFeedItem(
  item: TerminalSourceFeedItem,
  index: number,
): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(item)) {
    if (!sourceItemWhitelist.includes(key)) {
      errors.push(
        `source.items[${index}].${key} is outside the non-click source whitelist`,
      );
    }
  }
  errors.push(...validateSourceTitle(item.title, index));
  validateVisibleSourceText(
    item.sourceDomain,
    `source.items[${index}].sourceDomain`,
    errors,
  );
  if (item.sourceDomain.includes("/") || item.sourceDomain.startsWith("@")) {
    errors.push(`source.items[${index}].sourceDomain must be a bare host`);
  }
  return errors;
}

function validateSourceFeed(
  topology: TerminalPreviewPublicTopology,
): string[] {
  return (
    topology.source?.items.flatMap((item, index) =>
      validateSourceFeedItem(item, index),
    ) ?? []
  );
}

export function validateReaderTerminalPublicTopology(
  topology: TerminalPreviewPublicTopology,
): string[] {
  return validateBreakingRadarTitleWindow(topology.liveRadar).concat(
    topology.articleNewsFeed.items.flatMap((item, index) =>
      validateArticleFeedItem(item, index),
    ),
    validateSourceFeed(topology),
  );
}

export const readerTerminalPublicTopology: TerminalPreviewPublicTopology = {
  liveRadar: {
    title: {
      en: "Live Radar",
      ja: "速報タイトル",
    },
    items: [
      {
        id: "radar.xnews.ai-model-policy.2026-07-01",
        sourceLane: "x_news_trends",
        sourceLabel: {
          en: "X News / Trends",
          ja: "X News / Trends",
        },
        family: "AI / Capital",
        title: {
          en: "AI model policy headlines are rising on X",
          ja: "AIモデル政策関連ニュースがX上で急浮上",
        },
        status: "checking",
        freshnessLabel: {
          en: "Checking",
          ja: "確認中",
        },
        displayMode: "title_only",
        publishDecision: "not_authorized",
        href: null,
      },
      {
        id: "radar.sde.crypto-policy.2026-07-01",
        sourceLane: "sde_phase1_breaking_radar",
        sourceLabel: {
          en: "SDE Phase1 Breaking Radar",
          ja: "SDE Phase1 Breaking Radar",
        },
        family: "Crypto / Policy",
        title: {
          en: "Crypto policy item entered the SDE review lane",
          ja: "暗号資産政策項目がSDE確認レーンに入る",
        },
        status: "sde_review_pending",
        freshnessLabel: {
          en: "SDE review pending",
          ja: "SDE確認待ち",
        },
        displayMode: "title_only",
        publishDecision: "not_authorized",
        href: null,
      },
      {
        id: "radar.manual.onchain-state.2026-07-01",
        sourceLane: "manual_operator_observation",
        sourceLabel: {
          en: "Manual observation",
          ja: "Manual observation",
        },
        family: "On-chain / Market",
        title: {
          en: "On-chain state remains a Terminal data point, not a headline claim",
          ja: "オンチェーン状態は見出し主張ではなくTerminalデータとして確認",
        },
        status: "checking",
        freshnessLabel: {
          en: "Checking",
          ja: "確認中",
        },
        displayMode: "title_only",
        publishDecision: "not_authorized",
        href: null,
      },
      ...breakingRadarManualLinkNoteItems,
    ],
  },
  articleNewsFeed: {
    title: {
      en: "Published Intelligence",
      ja: "公開済みインテリジェンス",
    },
    items: [
      {
        id: "feed.weekend-12-indicators.2026-w26",
        family: "Weekend 12 indicators",
        title: {
          en: "The Window That Didn't Open",
          ja: "越えなかった窓",
        },
        href: "/brief/2026-W26-brief",
        publishedAt: "2026-06-27T18:00:00+09:00",
        excerpt: {
          en: "Cardano build progress, the missed fork window, and macro-led risk-off.",
          ja: "Cardanoのビルド進展、逃したfork窓、マクロ主導risk-offを整理。",
        },
      },
      {
        id: "feed.12-indicators.2026-w25",
        family: "12 indicators",
        title: {
          en: "The Fed Changes Its Voice",
          ja: "Fedが語り方を変えた",
        },
        href: "/brief/2026-W25-brief",
        publishedAt: "2026-06-20T18:00:00+09:00",
        excerpt: {
          en: "Warsh's first Fed meeting, dollar strength, and quiet crypto tape.",
          ja: "Warsh初会合、ドル高、静かな暗号資産相場を整理。",
        },
      },
      {
        id: "feed.deep-dive.2026-w24",
        family: "Deep Dive",
        title: {
          en: "The Audit Gate",
          ja: "監査ゲート",
        },
        href: "/brief/2026-W24-brief",
        publishedAt: "2026-06-13T18:00:00+09:00",
        excerpt: {
          en: "Hydra voting closed and the execution clock moved to verification.",
          ja: "Hydra投票完了後、実行の時計が検証へ移った局面。",
        },
      },
      {
        id: "feed.next-era-map.2026-w23",
        family: "Next Era Map",
        title: {
          en: "The Widening Gap",
          ja: "広がる乖離",
        },
        href: "/brief/2026-W23-brief",
        publishedAt: "2026-06-06T18:00:00+09:00",
        excerpt: {
          en: "The price/build divergence widened while Cardano shipped through the selloff.",
          ja: "価格と実装の乖離が広がる中で、Cardanoの出荷密度を整理。",
        },
      },
    ],
  },
};
