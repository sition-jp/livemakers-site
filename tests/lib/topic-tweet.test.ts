import { describe, expect, it } from "vitest";

import { extractTopicTweetId } from "@/lib/articles/topic-tweet";

describe("extractTopicTweetId", () => {
  it("returns the first external status id (x.com / twitter.com 両対応)", () => {
    const body = "リード https://x.com/Cardano/status/2087897484144111727 続き";
    expect(extractTopicTweetId(body)).toBe("2087897484144111727");
  });

  it("skips own accounts (case-insensitive)", () => {
    const body = [
      "https://x.com/SITIONjp/status/111",
      "https://x.com/SIPO_Tokyo/status/222",
      "https://x.com/LifeMakersCom/status/333",
      "https://twitter.com/IntersectMBO/status/444",
    ].join("\n");
    expect(extractTopicTweetId(body)).toBe("444");
  });

  it("ignores query strings when picking the id", () => {
    const body = "A https://twitter.com/Cardano/status/555?s=20&t=abc B";
    expect(extractTopicTweetId(body)).toBe("555");
  });

  it("returns null when no external status url exists", () => {
    expect(extractTopicTweetId("https://example.com/page のみ")).toBeNull();
    expect(extractTopicTweetId("")).toBeNull();
  });
});
