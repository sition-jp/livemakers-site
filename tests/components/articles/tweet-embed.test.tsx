/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import type { Tweet } from "react-tweet/api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TweetCard } from "@/components/articles/TweetEmbed";
import {
  buildXVideoSrcDoc,
  hasXVideo,
  pickXVideoMp4,
  type XVideoMedia,
} from "@/lib/articles/x-video";
import videoTweet from "@/tests/fixtures/x-tweet-tesla-video.json";

const getTweet = vi.fn();
vi.mock("react-tweet/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-tweet/api")>()),
  getTweet: (id: string) => getTweet(id),
}));

const VIDEO = videoTweet as unknown as Tweet;
const videoMedia = VIDEO.mediaDetails![0] as XVideoMedia;

const PHOTO: Tweet = {
  ...VIDEO,
  video: undefined,
  mediaDetails: [
    {
      ...videoMedia,
      type: "photo",
      media_url_https: "https://pbs.twimg.com/media/AbCdEf.jpg",
    } as unknown as NonNullable<Tweet["mediaDetails"]>[number],
  ],
};

const renderCard = async (tweet: Tweet | undefined | Error) => {
  if (tweet instanceof Error) getTweet.mockRejectedValueOnce(tweet);
  else getTweet.mockResolvedValueOnce(tweet);
  return render(<>{await TweetCard({ id: "2110913438293647789" })}</>);
};

afterEach(() => {
  getTweet.mockReset();
  vi.restoreAllMocks();
});

describe("x-video helpers", () => {
  it("detects video and animated_gif media only", () => {
    expect(hasXVideo(VIDEO)).toBe(true);
    expect(hasXVideo(PHOTO)).toBe(false);
    expect(hasXVideo({ mediaDetails: undefined })).toBe(false);
  });

  it("picks the highest mp4 at or under 2.5Mbps (720p here, not react-tweet's 1080p)", () => {
    expect(pickXVideoMp4(videoMedia)).toContain("/1280x720/");
  });

  it("falls back to the lightest mp4 when every variant is over the cap", () => {
    const heavy = {
      ...videoMedia,
      video_info: {
        ...videoMedia.video_info,
        variants: [
          { content_type: "video/mp4", bitrate: 9_000_000, url: "https://video.twimg.com/a/9.mp4" },
          { content_type: "video/mp4", bitrate: 5_000_000, url: "https://video.twimg.com/a/5.mp4" },
        ],
      },
    } as XVideoMedia;
    expect(pickXVideoMp4(heavy)).toBe("https://video.twimg.com/a/5.mp4");
  });

  it("rejects non-twimg video URLs", () => {
    const foreign = {
      ...videoMedia,
      video_info: {
        ...videoMedia.video_info,
        variants: [{ content_type: "video/mp4", bitrate: 1, url: "https://evil.example/x.mp4" }],
      },
    } as XVideoMedia;
    expect(pickXVideoMp4(foreign)).toBeNull();
    expect(buildXVideoSrcDoc(foreign)).toBeNull();
  });

  it("builds a no-referrer document with a click-to-play video", () => {
    const doc = buildXVideoSrcDoc(videoMedia)!;
    expect(doc).toContain('<meta name="referrer" content="no-referrer">');
    expect(doc).toContain('controls playsinline preload="none"');
    expect(doc).toContain('poster="https://pbs.twimg.com/amplify_video_thumb/');
    expect(doc).toMatch(/<source src="https:\/\/video\.twimg\.com\/[^"]+1280x720[^"]+" type="video\/mp4">/);
    expect(doc).not.toContain("autoplay");
  });

  it("loops animated GIFs muted, like X does", () => {
    const doc = buildXVideoSrcDoc({ ...videoMedia, type: "animated_gif" } as XVideoMedia)!;
    expect(doc).toContain("autoplay loop muted playsinline");
  });
});

describe("TweetCard", () => {
  it("renders a video tweet with the video inside a no-referrer iframe, not a bare <video>", async () => {
    const { container } = await renderCard(VIDEO);
    const iframe = container.querySelector("[data-x-video] iframe");
    expect(iframe?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframe?.getAttribute("srcdoc")).toContain('content="no-referrer"');
    expect(container.querySelector("video")).toBeNull();
    // カードの他の部分は react-tweet の部品のまま
    expect(container.textContent).toContain("Real life, baby");
    expect(container.querySelector("article")).not.toBeNull();
  });

  it("renders a tweet without video exactly as react-tweet's EmbeddedTweet (no iframe)", async () => {
    const { container } = await renderCard(PHOTO);
    expect(container.querySelector("[data-x-video]")).toBeNull();
    expect(container.querySelector("img[src^='https://pbs.twimg.com/media/AbCdEf']")).not.toBeNull();
  });

  it("renders nothing when the tweet is gone or the fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await renderCard(undefined)).container.innerHTML).toBe("");
    expect((await renderCard(new Error("boom"))).container.innerHTML).toBe("");
  });
});
