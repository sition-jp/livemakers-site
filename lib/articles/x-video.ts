import { getMediaUrl } from "react-tweet";
import type { MediaAnimatedGif, MediaDetails, MediaVideo, Tweet } from "react-tweet/api";

/**
 * 肝ツイートの動画を記事ページで再生するための部品 (2026-10-16 田平氏 GO)。
 *
 * video.twimg.com は Referer が x.com 以外 (livemakers.com を含む) だと 403 を
 * 返し、Referer なしなら 206 を返す。`<video>` には referrerpolicy 属性が無いので、
 * 動画 1 枚だけを srcdoc の iframe に入れ、その文書の中だけ no-referrer にする。
 * 記事ページ全体の referrer policy には触れない。
 */

export type XVideoMedia = MediaVideo | MediaAnimatedGif;

/** 画質の上限。react-tweet 既定 (2 番目に高い = 1080p 約 10Mbps) は記事の埋め込みには重い。 */
const MAX_BITRATE = 2_500_000;

export function isXVideoMedia(media: MediaDetails): media is XVideoMedia {
  return media.type === "video" || media.type === "animated_gif";
}

export function hasXVideo(tweet: Pick<Tweet, "mediaDetails">): boolean {
  return (tweet.mediaDetails ?? []).some(isXVideoMedia);
}

function twimgHttpsUrl(raw: string, host: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === host ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 上限以下で最も高いビットレートの mp4 (全て上限超なら最も軽いもの)。 */
export function pickXVideoMp4(media: XVideoMedia): string | null {
  const mp4s = media.video_info.variants
    .filter((v) => v.content_type === "video/mp4")
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  const chosen = mp4s.find((v) => (v.bitrate ?? 0) <= MAX_BITRATE) ?? mp4s.at(-1);
  return chosen ? twimgHttpsUrl(chosen.url, "video.twimg.com") : null;
}

const escapeAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * iframe srcdoc に入れる文書。meta referrer で、この文書からの取得だけ Referer を
 * 付けない。GIF は X と同じくループ自動再生 (無音・小容量)。URL が twimg の
 * https でなければ null (呼び出し側は react-tweet の既定描画に戻す)。
 */
export function buildXVideoSrcDoc(media: XVideoMedia): string | null {
  const src = pickXVideoMp4(media);
  const poster = twimgHttpsUrl(getMediaUrl(media, "small"), "pbs.twimg.com");
  if (src === null || poster === null) return null;
  const playback =
    media.type === "animated_gif"
      ? "autoplay loop muted playsinline"
      : 'controls playsinline preload="none"';
  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer">',
    "<style>html,body{margin:0;height:100%;background:#000}",
    "video{display:block;width:100%;height:100%;object-fit:contain}</style></head>",
    `<body><video ${playback} poster="${escapeAttr(poster)}">`,
    `<source src="${escapeAttr(src)}" type="video/mp4"></video></body></html>`,
  ].join("");
}
