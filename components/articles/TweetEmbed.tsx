import { Tweet } from "react-tweet";

/**
 * 記事の肝ツイート 1 本の静的カード (2026-08-14 田平氏 GO — Phase 2)。
 * RSC でサーバー側 fetch し、取得不能 (削除・一時障害) は何も描画しない —
 * 記事表示を止めない。prose 配下で崩れないよう not-prose で切る。
 */
export function TweetEmbed({ id }: { id: string }) {
  return (
    <div data-topic-tweet={id} className="not-prose my-6 flex justify-center">
      <Tweet id={id} components={{ TweetNotFound: () => <></> }} />
    </div>
  );
}
