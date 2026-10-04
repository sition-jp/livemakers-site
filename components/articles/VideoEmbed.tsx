/**
 * 記事の当事者動画 1 本の埋め込み (2026-10-04 田平氏 GO — 改善策 ④)。
 * プライバシー強化モード (youtube-nocookie) + 遅延読み込み。削除・非公開の
 * 動画は YouTube 側の表示に任せる — 記事表示は止めない。prose 配下で
 * 崩れないよう not-prose で切る。
 */
export function VideoEmbed({ id }: { id: string }) {
  return (
    <div data-topic-video={id} className="not-prose mx-auto my-6 aspect-video w-full max-w-2xl">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title="YouTube 動画"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="h-full w-full border-0"
      />
    </div>
  );
}
