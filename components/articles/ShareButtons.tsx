import { XIcon } from "@/components/brand/XIcon";
import { X_HANDLE } from "@/lib/site";

/**
 * 記事末のシェアボタン (2026-11-09 到達の第 0 段): X・LINE・はてなブックマーク。
 *
 * 各サービスの共有用 URL を開くだけのリンクで、外部スクリプトは読まない
 * (ページを重くしない・閲覧者を追跡しない)。server component なので
 * client bundle も増えない。文言はページ側 (server) で解決して渡す。
 */

export type ShareButtonsCopy = {
  heading: string;
  x: string;
  line: string;
  hatena: string;
};

/** 3 サービスの共有 URL。テストと描画が同じ組み立てを使う。 */
export function buildShareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return {
    x: `https://x.com/intent/post?text=${t}&url=${u}&via=${X_HANDLE}`,
    line: `https://social-plugins.line.me/lineit/share?url=${u}`,
    hatena: `https://b.hatena.ne.jp/add?mode=confirm&url=${u}&title=${t}`,
  };
}

const BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full border border-border-primary bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-tertiary";

export function ShareButtons({
  url,
  title,
  copy,
}: {
  url: string;
  title: string;
  copy: ShareButtonsCopy;
}) {
  const links = buildShareLinks(url, title);
  return (
    <aside data-share-buttons="" aria-label={copy.heading} className="mt-10">
      <p className="text-sm font-bold text-text-primary">{copy.heading}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a href={links.x} target="_blank" rel="noopener noreferrer" className={BUTTON_CLASS}>
          <XIcon className="h-4 w-4" />
          {copy.x}
        </a>
        <a href={links.line} target="_blank" rel="noopener noreferrer" className={BUTTON_CLASS}>
          {copy.line}
        </a>
        <a href={links.hatena} target="_blank" rel="noopener noreferrer" className={BUTTON_CLASS}>
          {copy.hatena}
        </a>
      </div>
    </aside>
  );
}
