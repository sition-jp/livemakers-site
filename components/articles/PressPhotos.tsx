import { PressPhotoImage } from "@/components/articles/PressPhotoImage";
import { SourceCard } from "@/components/articles/SourceCard";
import { getPressPhotos, type PressPhotos } from "@/lib/articles/prtimes-photos";
import type { SourceLink } from "@/lib/articles/source-links";

const GRID = { 1: "grid gap-2", 2: "grid gap-2 sm:grid-cols-2", 3: "grid gap-2 sm:grid-cols-3" } as const;

/**
 * PR TIMES リリースの写真 (最大 3 枚) + クレジット (2026-10-06 設計書 prtimes-press-photos §5)。
 * トリミングしない (object-fit: contain)。写真が無ければ、ツイートも動画も無い記事に限り
 * 筆頭の出典の大きいカードを代わりに出す。
 */
export function PressPhotosView({ photos, eagerFirst }: { photos: PressPhotos; eagerFirst: boolean }) {
  if (photos.images.length === 0) return null;
  return (
    <figure className="not-prose my-6" data-press-photos={photos.images.length}>
      <div className={GRID[photos.images.length as 1 | 2 | 3]}>
        {photos.images.map((src, index) => (
          <PressPhotoImage
            key={src}
            src={src}
            alt={`${photos.company}のプレスリリース画像 ${index + 1}`}
            eager={eagerFirst && index === 0}
          />
        ))}
      </div>
      <figcaption className="mt-1.5 text-xs text-text-tertiary">
        画像：{photos.company}（PR TIMES）
        <a className="ml-2 underline" href={photos.releaseUrl} target="_blank" rel="noopener noreferrer">
          プレスリリース
        </a>
      </figcaption>
    </figure>
  );
}

export async function PressPhotosBlock({
  url,
  fallbackLead,
  eagerFirst,
}: {
  url: string;
  fallbackLead?: SourceLink;
  eagerFirst: boolean;
}) {
  const photos = await getPressPhotos(url);
  if (!photos || photos.images.length === 0) {
    return fallbackLead ? <SourceCard url={fallbackLead.url} label={fallbackLead.label} size="large" /> : null;
  }
  return <PressPhotosView photos={photos} eagerFirst={eagerFirst} />;
}
