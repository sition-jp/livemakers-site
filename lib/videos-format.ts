/**
 * 動画の長さの表記 (例: 38分23秒)。
 *
 * lib/videos.ts は fs を読むのでブラウザに載せられない。記事の右レーン
 * (components/articles/ArticleRailClient.tsx・ブラウザで描く) が動画の窓
 * (VideoRailCard) を使うため、この関数だけを fs を読まないここへ分けた
 * (2026-11-20・Vercel ISR Writes 削減)。lib/videos.ts からも同じ名前で読める。
 */
export function formatDurationJa(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours > 0 ? `${hours}時間` : ""}${minutes}分${seconds}秒`;
}
