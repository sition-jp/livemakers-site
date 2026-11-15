/**
 * AI ボットなど、自動で来る相手の一覧 (2026-11-15 田平氏 GO)。
 *
 * - robots.txt で名指しするもの (`robots: true`) と、User-Agent から種別を
 *   判定するもの (来訪の計測) の両方の元データ。
 * - `source` は各社の公式の説明ページ。名前と用途はそこで確かめたもの。
 * - 公式ページで確かめられなかった名前 (Bytespider・TelegramBot・Discordbot)
 *   は入れていない。来た場合は `other_bot` として数えられる。
 */

export type BotCategory =
  | "training"
  | "search"
  | "user_fetch"
  | "search_engine"
  | "preview"
  | "other_bot";

export interface KnownBot {
  name: string;
  /** User-Agent に含まれる文字列 (大文字小文字を区別しない)。 */
  token: string;
  category: BotCategory;
  /** robots.txt で名指しするか。 */
  robots: boolean;
  /** 公式の説明ページ。 */
  source: string;
}

const OPENAI = "https://developers.openai.com/api/docs/bots";
const ANTHROPIC =
  "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler";
const PERPLEXITY = "https://docs.perplexity.ai/guides/bots";
const META = "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers";
const GOOGLE = "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers";
const BING = "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0";
const SLACK = "https://api.slack.com/robots";
const X_CARDS = "https://developer.x.com/en/docs/x-for-websites/cards/guides/getting-started";

function bot(
  name: string,
  category: BotCategory,
  robots: boolean,
  source: string,
): KnownBot {
  return { name, token: name, category, robots, source };
}

export const KNOWN_BOTS: readonly KnownBot[] = [
  bot("GPTBot", "training", true, OPENAI),
  bot("OAI-SearchBot", "search", true, OPENAI),
  bot("ChatGPT-User", "user_fetch", true, OPENAI),
  bot("ClaudeBot", "training", true, ANTHROPIC),
  bot("Claude-SearchBot", "search", true, ANTHROPIC),
  bot("Claude-User", "user_fetch", true, ANTHROPIC),
  bot("PerplexityBot", "search", true, PERPLEXITY),
  bot("Perplexity-User", "user_fetch", true, PERPLEXITY),
  bot("CCBot", "training", true, "https://commoncrawl.org/ccbot"),
  bot("meta-externalagent", "training", true, META),
  bot("Amazonbot", "training", true, "https://developer.amazon.com/amazonbot"),
  bot("Googlebot", "search_engine", false, GOOGLE),
  bot("Bingbot", "search_engine", false, BING),
  bot("Slackbot", "preview", false, SLACK),
  bot("Twitterbot", "preview", false, X_CARDS),
  bot("facebookexternalhit", "preview", false, META),
];

/** User-Agent を持たず robots.txt のトークンだけで効くもの。 */
export const ROBOTS_ONLY_TOKENS: readonly string[] = [
  "Google-Extended",
  "Applebot-Extended",
];

/** robots.txt の除外。`*` と名指しの全グループで同じものを使う。 */
export const ROBOTS_DISALLOW: readonly string[] = [
  "/api/",
  "/ja/article-inflow-preview",
  "/en/article-inflow-preview",
  "/ja/terminal-preview",
  "/en/terminal-preview",
  "/*?_rsc=",
  "/*&_rsc=",
];

// 短い名前が長い名前に含まれる組 (Claude-User / ClaudeBot など) を取り違えない
// よう、長い token から順に照合する。
const BY_TOKEN_LENGTH = [...KNOWN_BOTS].sort((a, b) => b.token.length - a.token.length);

export function classifyUserAgent(
  ua: string | null | undefined,
): { bot: string; category: BotCategory } | null {
  if (!ua) return null;
  const lower = ua.toLowerCase();
  for (const b of BY_TOKEN_LENGTH) {
    if (lower.includes(b.token.toLowerCase())) {
      return { bot: b.name, category: b.category };
    }
  }
  if (/bot|crawler|spider/i.test(ua)) return { bot: "other", category: "other_bot" };
  return null;
}
