import { describe, expect, it } from "vitest";

import { buildVideoJsonLd } from "@/lib/seo/video-json-ld";
import { getVideoBySlug, type Video } from "@/lib/videos";

const EP001 = getVideoBySlug("ep001-finance-reboot")!;
const POSTED: Video = {
  ...EP001,
  youtubeVideoId: "PlMDhxjz13k",
  publishedAtJst: "2026-10-31T12:24:07+09:00",
};

describe("lib/seo/video-json-ld", () => {
  it("YouTube に上がっていない回 (動画 ID か公開日時が無い) は出さない", () => {
    expect(buildVideoJsonLd({ ...POSTED, youtubeVideoId: undefined }, "ja")).toBeNull();
    expect(buildVideoJsonLd({ ...POSTED, publishedAtJst: undefined }, "ja")).toBeNull();
  });

  it("VideoObject の必須項目と埋め込み先を持つ", () => {
    const json = buildVideoJsonLd(POSTED, "ja")!;
    expect(json["@type"]).toBe("VideoObject");
    expect(json.name).toBe(
      "金融は再起動している｜AI×暗号資産×ブロックチェーンが拓く自律分散型の金融と経済、2026年秋の兆しを読む",
    );
    expect(json.description).toBe(POSTED.excerptJa);
    expect(json.uploadDate).toBe("2026-10-31T12:24:07+09:00");
    expect(json.duration).toBe("PT41M25S");
    expect(json.embedUrl).toBe("https://www.youtube-nocookie.com/embed/PlMDhxjz13k");
    expect(json.url).toBe("https://www.youtube.com/watch?v=PlMDhxjz13k");
    expect(json.thumbnailUrl).toEqual([
      "https://livemakers.com/thumbnails/video-ep001-finance-reboot.jpg",
      "https://i.ytimg.com/vi/PlMDhxjz13k/hqdefault.jpg",
    ]);
    expect(json.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": "https://livemakers.com/ja/videos/ep001-finance-reboot",
    });
    expect(json.inLanguage).toBe("ja");
  });

  it("チャプターを Clip にし、終わりを次のチャプターの始まり (最後は動画の長さ) にする", () => {
    const clips = buildVideoJsonLd(POSTED, "ja")!.hasPart;
    expect(clips).toHaveLength(8);
    expect(clips[0]).toEqual({
      "@type": "Clip",
      name: "金融が、静かに再起動している",
      startOffset: 0,
      endOffset: 389,
      url: "https://www.youtube.com/watch?v=PlMDhxjz13k",
    });
    expect(clips[1]).toMatchObject({ startOffset: 389, endOffset: 667, url: "https://www.youtube.com/watch?v=PlMDhxjz13k&t=389s" });
    expect(clips[7]).toMatchObject({ startOffset: 2167, endOffset: 2485 });
  });

  it("1 時間以上の長さも ISO 8601 で書く", () => {
    expect(buildVideoJsonLd({ ...POSTED, durationSeconds: 3725 }, "ja")!.duration).toBe("PT1H2M5S");
  });
});
