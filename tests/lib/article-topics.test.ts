import { describe, expect, it } from "vitest";

import { ARTICLE_TOPICS, isArticleTopic, topicPageHref } from "@/lib/articles/topics";

describe("topics", () => {
  it("knows the funding topic only", () => {
    expect(ARTICLE_TOPICS).toEqual(["funding"]);
    expect(isArticleTopic("funding")).toBe(true);
    expect(isArticleTopic("../rail")).toBe(false);
  });

  it("topicPageHref: page 1 and page 3", () => {
    expect(topicPageHref("funding", 1)).toBe("/topics/funding");
    expect(topicPageHref("funding", 3)).toBe("/topics/funding/page/3");
  });
});
