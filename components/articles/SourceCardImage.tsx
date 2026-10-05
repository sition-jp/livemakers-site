"use client";

function hideFailedImage(img: HTMLImageElement) {
  const large = img.closest<HTMLElement>("[data-source-card='large']");
  if (large) large.style.display = "none";
  else img.style.display = "none";
}

/**
 * hydration より前に読み込みが失敗すると onError は届かない — 付いた時点の状態も見る。
 * 大きいカード (eager) だけに使う: 読み込み前の lazy 画像を complete と報告する
 * ブラウザがあり、小さいカードの画像を誤って消してしまうため。
 */
function hideIfAlreadyFailed(img: HTMLImageElement | null) {
  if (img && img.complete && img.naturalWidth === 0) hideFailedImage(img);
}

/**
 * 出典カードの画像。相手サイトから直接読み込む (設計書 §1 A 案 — 保存しない・
 * next/image の最適化も複製になるので使わない)。読めなければ、大きいカードは
 * カードごと・小さいカードは画像だけを隠す (§2-3 / §2-4)。大きいカードは最初の
 * 段落の直後 (ファーストビュー) なので eager で読み、hydration 前の失敗も拾う。
 * 小さいカードは lazy のまま onError だけで隠す。
 */
export function SourceCardImage({
  src,
  className,
  eager = false,
}: {
  src: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <img
      ref={eager ? hideIfAlreadyFailed : undefined}
      src={src}
      alt=""
      loading={eager ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      className={className}
      onError={(event) => hideFailedImage(event.currentTarget)}
    />
  );
}
