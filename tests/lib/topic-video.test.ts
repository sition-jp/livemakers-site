import { describe, expect, it } from "vitest";

import { extractTopicVideoId } from "@/lib/articles/topic-video";

describe("extractTopicVideoId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=WpGs7DKe8QY", "WpGs7DKe8QY"],
    ["https://youtube.com/watch?feature=share&v=WpGs7DKe8QY&t=30", "WpGs7DKe8QY"],
    ["https://m.youtube.com/watch?v=WpGs7DKe8QY", "WpGs7DKe8QY"],
    ["https://youtu.be/Xt05z3xJnBE?si=abc", "Xt05z3xJnBE"],
    ["https://www.youtube.com/live/-E8Xyg5-1Ok", "-E8Xyg5-1Ok"],
    ["https://www.youtube.com/shorts/q5sZIdeC8eM", "q5sZIdeC8eM"],
  ])("reads the id from %s", (url, id) => {
    expect(extractTopicVideoId(`リード ${url} 続き`)).toBe(id);
  });

  it("returns the first video when several appear", () => {
    const body = [
      "- [配信](https://www.youtube.com/live/Xt05z3xJnBE)",
      "- [発表](https://www.youtube.com/watch?v=WpGs7DKe8QY)",
    ].join("\n");
    expect(extractTopicVideoId(body)).toBe("Xt05z3xJnBE");
  });

  it("ignores channel, playlist and malformed urls", () => {
    expect(extractTopicVideoId("https://www.youtube.com/@charleshoskinsoncrypto")).toBeNull();
    expect(extractTopicVideoId("https://www.youtube.com/playlist?list=PL123")).toBeNull();
    // 11 文字に満たない / 超える id は動画 URL とみなさない
    expect(extractTopicVideoId("https://youtu.be/short")).toBeNull();
    expect(extractTopicVideoId("https://youtu.be/WpGs7DKe8QYextra")).toBeNull();
    expect(extractTopicVideoId("")).toBeNull();
  });
});
