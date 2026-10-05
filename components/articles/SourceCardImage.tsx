"use client";

/**
 * 出典カードの画像。相手サイトから直接読み込む (設計書 §1 A 案 — 保存しない・
 * next/image の最適化も複製になるので使わない)。読めなければ、大きいカードは
 * カードごと・小さいカードは画像だけを隠す (§2-3 / §2-4)。
 */
export function SourceCardImage({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={className}
      onError={(event) => {
        const img = event.currentTarget;
        const large = img.closest<HTMLElement>("[data-source-card='large']");
        if (large) large.style.display = "none";
        else img.style.display = "none";
      }}
    />
  );
}
