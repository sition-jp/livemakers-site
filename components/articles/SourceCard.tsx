import { SourceCardImage } from "@/components/articles/SourceCardImage";
import { fetchLinkPreview, type LinkPreview } from "@/lib/articles/link-preview";

/**
 * 出典カード (2026-10-05 設計書 source-link-cards §2)。文字は書き手が付けた
 * 出典名だけ — 相手サイトのタイトルは出さない。大きいカードは画像があるときだけ。
 * prose 配下で崩れないよう not-prose で切る (TweetEmbed / VideoEmbed と同じ)。
 */
export type SourceCardSize = "small" | "large";

type Props = { url: string; label: string; size: SourceCardSize };

const FRAME: Record<SourceCardSize, string> = {
  small:
    "not-prose flex items-center gap-3 rounded-lg border border-border-primary bg-bg-secondary p-2.5 no-underline transition-colors hover:bg-bg-tertiary",
  large:
    "not-prose my-6 flex flex-col overflow-hidden rounded-lg border border-border-primary bg-bg-secondary no-underline transition-colors hover:bg-bg-tertiary",
};

const IMAGE: Record<SourceCardSize, string> = {
  small: "h-14 w-24 flex-none rounded object-cover",
  large: "aspect-video w-full object-cover",
};

const TEXT: Record<SourceCardSize, string> = {
  small: "flex min-w-0 flex-col gap-0.5",
  large: "flex flex-col gap-0.5 px-4 py-3",
};

export function SourceCardView({ url, label, size, preview }: Props & { preview: LinkPreview }) {
  if (size === "large" && !preview.image) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" data-source-card={size} className={FRAME[size]}>
      {preview.image ? <SourceCardImage src={preview.image} className={IMAGE[size]} /> : null}
      <span className={TEXT[size]}>
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <span className="text-xs text-text-tertiary">{preview.siteName}</span>
      </span>
    </a>
  );
}

export async function SourceCard(props: Props) {
  const preview = await fetchLinkPreview(props.url);
  return <SourceCardView {...props} preview={preview} />;
}
