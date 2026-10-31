import { buildVideoJsonLd } from "@/lib/seo/video-json-ld";
import type { Video } from "@/lib/videos";

/**
 * 動画の記事に `VideoObject` 構造化データを埋め込む。YouTube に上がる前の回は
 * 何も出さない。ビルダー本体 (`lib/seo/video-json-ld.ts`) は `ArticleJsonLd`
 * と同じく DOM 抜きでテストする。
 */
export function VideoJsonLd({ video, lang }: { video: Video; lang: "ja" | "en" }) {
  const json = buildVideoJsonLd(video, lang);
  if (!json) return null;
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
