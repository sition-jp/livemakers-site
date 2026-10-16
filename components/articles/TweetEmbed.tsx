import { Suspense } from "react";
import {
  EmbeddedTweet,
  QuotedTweet,
  TweetActions,
  TweetBody,
  TweetContainer,
  TweetHeader,
  TweetInReplyTo,
  TweetInfo,
  TweetMedia,
  TweetReplies,
  TweetSkeleton,
  enrichTweet,
} from "react-tweet";
import { getTweet, type Tweet } from "react-tweet/api";

import { buildXVideoSrcDoc, hasXVideo, isXVideoMedia } from "@/lib/articles/x-video";

/**
 * 記事の肝ツイート 1 本の静的カード (2026-08-14 田平氏 GO — Phase 2)。
 * RSC でサーバー側 fetch し、取得不能 (削除・一時障害) は何も描画しない —
 * 記事表示を止めない。prose 配下で崩れないよう not-prose で切る。
 *
 * 動画付きの投稿だけ、動画部分を XVideoFrame に差し替える (2026-10-16 田平氏 GO —
 * react-tweet の `<video>` は Referer 付きで video.twimg.com に 403 を返される)。
 * 動画なしの投稿は react-tweet の <Tweet> と同じ描画 (getTweet → EmbeddedTweet)。
 */
export function TweetEmbed({ id }: { id: string }) {
  return (
    <div data-topic-tweet={id} className="not-prose my-6 flex justify-center">
      <Suspense fallback={<TweetSkeleton />}>
        <TweetCard id={id} />
      </Suspense>
    </div>
  );
}

export async function TweetCard({ id }: { id: string }) {
  const tweet = await getTweet(id).catch((err: unknown) => {
    console.error(err);
    return undefined;
  });
  if (!tweet) return null;
  return hasXVideo(tweet) ? <VideoTweet tweet={tweet} /> : <EmbeddedTweet tweet={tweet} />;
}

/** EmbeddedTweet と同じ並びで、本体の動画だけ XVideoFrame にする。 */
function VideoTweet({ tweet: raw }: { tweet: Tweet }) {
  const media = raw.mediaDetails ?? [];
  const frames = media.filter(isXVideoMedia).map((m) => ({ media: m, srcDoc: buildXVideoSrcDoc(m) }));
  // URL が想定外なら iframe に入れず react-tweet の既定描画に戻す
  if (frames.some((f) => f.srcDoc === null)) return <EmbeddedTweet tweet={raw} />;
  const photos = media.filter((m) => !isXVideoMedia(m));
  const tweet = enrichTweet(raw);
  return (
    <TweetContainer>
      <TweetHeader tweet={tweet} />
      {tweet.in_reply_to_status_id_str && <TweetInReplyTo tweet={tweet} />}
      <TweetBody tweet={tweet} />
      {photos.length > 0 && <TweetMedia tweet={{ ...tweet, mediaDetails: photos }} />}
      {frames.map(({ media: m, srcDoc }) => (
        <XVideoFrame
          key={m.media_url_https}
          srcDoc={srcDoc as string}
          width={m.original_info.width}
          height={m.original_info.height}
        />
      ))}
      {tweet.quoted_tweet && <QuotedTweet tweet={tweet.quoted_tweet} />}
      <TweetInfo tweet={tweet} />
      <TweetActions tweet={tweet} />
      <TweetReplies tweet={tweet} />
    </TweetContainer>
  );
}

/** 動画 1 枚の枠。見た目は react-tweet のメディア枠 (角丸 12px・上余白 0.75rem) に揃える。 */
export function XVideoFrame({
  srcDoc,
  width,
  height,
}: {
  srcDoc: string;
  width: number;
  height: number;
}) {
  return (
    <div
      data-x-video=""
      style={{
        marginTop: "0.75rem",
        overflow: "hidden",
        border: "var(--tweet-border)",
        borderRadius: 12,
        aspectRatio: width > 0 && height > 0 ? `${width} / ${height}` : "16 / 9",
        background: "#000",
      }}
    >
      <iframe
        srcDoc={srcDoc}
        title="X の動画"
        loading="lazy"
        referrerPolicy="no-referrer"
        allow="fullscreen; picture-in-picture"
        allowFullScreen
        style={{ display: "block", width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
}
