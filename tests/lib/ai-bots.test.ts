import { describe, expect, it } from "vitest";

import {
  KNOWN_BOTS,
  ROBOTS_DISALLOW,
  ROBOTS_ONLY_TOKENS,
  classifyUserAgent,
} from "@/lib/ai-bots";

describe("classifyUserAgent", () => {
  const cases: Array<[string, string, string]> = [
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2; +https://openai.com/gptbot)", "GPTBot", "training"],
    ["Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)", "OAI-SearchBot", "search"],
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)", "ChatGPT-User", "user_fetch"],
    ["Mozilla/5.0 AppleWebKit/537.36 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", "ClaudeBot", "training"],
    ["Mozilla/5.0 (compatible; Claude-SearchBot/1.0)", "Claude-SearchBot", "search"],
    ["Mozilla/5.0 (compatible; Claude-User/1.0)", "Claude-User", "user_fetch"],
    ["Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", "PerplexityBot", "search"],
    ["Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)", "Perplexity-User", "user_fetch"],
    ["CCBot/2.0 (https://commoncrawl.org/faq/)", "CCBot", "training"],
    ["meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)", "meta-externalagent", "training"],
    ["Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)", "Amazonbot", "training"],
    ["Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Googlebot", "search_engine"],
    ["Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "Bingbot", "search_engine"],
    ["Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)", "Slackbot", "preview"],
    ["Twitterbot/1.0", "Twitterbot", "preview"],
    ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "facebookexternalhit", "preview"],
  ];

  it.each(cases)("%s", (ua, bot, category) => {
    expect(classifyUserAgent(ua)).toEqual({ bot, category });
  });

  it("does not mix up Claude-User with ClaudeBot, nor Claude-SearchBot", () => {
    expect(classifyUserAgent("Claude-User/1.0")?.bot).toBe("Claude-User");
    expect(classifyUserAgent("ClaudeBot/1.0")?.bot).toBe("ClaudeBot");
  });

  it("is case-insensitive", () => {
    expect(classifyUserAgent("gptbot/1.0")?.bot).toBe("GPTBot");
  });

  it("returns null for a person's browser and for empty values", () => {
    expect(
      classifyUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBeNull();
    expect(classifyUserAgent("")).toBeNull();
    expect(classifyUserAgent(null)).toBeNull();
    expect(classifyUserAgent(undefined)).toBeNull();
  });

  it("returns other_bot for unknown bot-like agents", () => {
    expect(classifyUserAgent("SomeNewBot/1.0")).toEqual({ bot: "other", category: "other_bot" });
    expect(classifyUserAgent("FooCrawler/2")).toEqual({ bot: "other", category: "other_bot" });
  });
});

describe("lists", () => {
  it("robots:true bots exclude search_engine and preview", () => {
    for (const b of KNOWN_BOTS.filter((x) => x.robots)) {
      expect(["search_engine", "preview"]).not.toContain(b.category);
    }
  });
  it("every bot has an https source", () => {
    for (const b of KNOWN_BOTS) expect(b.source).toMatch(/^https:\/\//);
  });
  it("exports robots-only tokens and the 9 disallow entries", () => {
    expect(ROBOTS_ONLY_TOKENS).toEqual(["Google-Extended", "Applebot-Extended"]);
    expect([...ROBOTS_DISALLOW]).toEqual([
      "/api/",
      "/ja/article-inflow-preview",
      "/en/article-inflow-preview",
      "/ja/terminal-preview",
      "/en/terminal-preview",
      "/ja/forecast-lab",
      "/en/forecast-lab",
      "/*?_rsc=",
      "/*&_rsc=",
    ]);
  });
});
