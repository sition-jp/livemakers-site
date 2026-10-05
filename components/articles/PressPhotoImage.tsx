"use client";

import { useCallback } from "react";

/** PR TIMES の写真 1 枚。相手の配信網から直接読み込み、読めなければ隠す (設計書 §5-2)。 */
export function PressPhotoImage({ src, alt, eager }: { src: string; alt: string; eager: boolean }) {
  const hideIfFailed = useCallback((img: HTMLImageElement) => {
    img.style.display = "none";
  }, []);

  const hideIfAlreadyFailed = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth === 0) {
        hideIfFailed(img);
      }
    },
    [hideIfFailed],
  );

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      className="aspect-[4/3] w-full rounded bg-bg-secondary object-contain"
      ref={eager ? hideIfAlreadyFailed : undefined}
      onError={(event) => {
        hideIfFailed(event.currentTarget);
      }}
    />
  );
}
