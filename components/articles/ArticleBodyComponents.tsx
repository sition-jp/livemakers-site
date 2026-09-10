import { Children, isValidElement, type ComponentProps, type ReactNode } from "react";

import { TweetEmbed } from "@/components/articles/TweetEmbed";
import {
  classifyMarkerHeading,
  hasDailyIntelBlockHeadings,
  slugifyHeading,
} from "@/lib/articles/toc";
import { extractTopicTweetId } from "@/lib/articles/topic-tweet";

/**
 * 記事本文 MDX の描画コンポーネント (G44 D10 の h2 anchor に加え、
 * X 公開体裁の平文マーカー見出しを表示層で昇格する)。
 *
 * mirror/site-first の本文は `■ 見出し` / Daily Intel ブロック絵文字で章を
 * 区切るが、markdown 見出しではないため素通しだと本文と同じ段落で描画される。
 * 本文文字列は feed checksum の証跡 (source = rendered) なので一切変更せず、
 * 「単独段落 1 行のマーカー行」だけを h2/h3 タグへ差し替える。
 * id は lib/articles/toc.ts の抽出と同一規則・同一順序で採番し、
 * TOC のアンカーとクライアント JS なしで一致させる。
 */
export function createArticleMdxComponents(body: string): {
  h2: (props: ComponentProps<"h2">) => ReactNode;
  p: (props: ComponentProps<"p">) => ReactNode;
  blockquote: (props: ComponentProps<"blockquote">) => ReactNode;
} {
  const hasBlocks = hasDailyIntelBlockHeadings(body);
  const used = new Map<string, number>();
  // 肝ツイート 1 本を「最初の実段落」の直後に一度だけ添える (2026-08-14
  // 田平氏 GO — Phase 2)。single-pass 前提の closure 状態は上の `used` Map と
  // 同じ既存パターン。body 文字列と checksum 契約には触れない
  let pendingTweetId = extractTopicTweetId(body);

  const claimId = (text: string): string => {
    const base = slugifyHeading(text);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };

  const lenientTextOf = (children: ReactNode): string => {
    if (typeof children === "string") return children;
    if (Array.isArray(children)) return children.map(lenientTextOf).join("");
    return "";
  };

  /** 段落全体が素のテキストのときだけ文字列を返す (リンク等を含む段落は昇格対象外)。 */
  const plainTextOf = (children: ReactNode): string | null => {
    if (typeof children === "string") return children;
    if (Array.isArray(children)) {
      const parts = children.map(plainTextOf);
      if (parts.some((part) => part === null)) return null;
      return parts.join("");
    }
    return null;
  };

  function H2({ children, ...props }: ComponentProps<"h2">) {
    return (
      <h2 id={claimId(lenientTextOf(children))} {...props}>
        {children}
      </h2>
    );
  }

  function P({ children, ...props }: ComponentProps<"p">) {
    const text = plainTextOf(children);
    if (text !== null && !text.includes("\n")) {
      const marker = classifyMarkerHeading(text, hasBlocks);
      if (marker) {
        const Tag = marker.level === 2 ? "h2" : "h3";
        return (
          <Tag id={claimId(text)} data-marker-heading="">
            {children}
          </Tag>
        );
      }
    }
    if (pendingTweetId !== null) {
      const id = pendingTweetId;
      pendingTweetId = null;
      return (
        <>
          <p {...props}>{children}</p>
          <TweetEmbed id={id} />
        </>
      );
    }
    return <p {...props}>{children}</p>;
  }

  /**
   * 出典注記ブロック (2026-09-11 田平氏 GO)。two_independent 記事の開示は
   * 本文の文ではなく、記事末の `> **出典について** …` 引用ブロックに置かれる。
   * その引用ブロックだけを小さな注記欄 (aside) として描き、本文と読み分け
   * られるようにする。body 文字列と checksum 契約には触れない (表示層のみ)。
   * 判定: 先頭の非空白子孫が <strong>出典について</strong> であること。
   */
  const SOURCE_NOTE_LABEL = "出典について";

  const firstMeaningfulChild = (children: ReactNode): ReactNode => {
    for (const child of Children.toArray(children)) {
      if (typeof child === "string" && child.trim() === "") continue;
      return child;
    }
    return null;
  };

  const isSourceNoteLabel = (node: ReactNode): boolean =>
    isValidElement(node) &&
    node.type === "strong" &&
    (plainTextOf((node.props as { children?: ReactNode }).children) ?? "").trim() ===
      SOURCE_NOTE_LABEL;

  const startsWithSourceNoteLabel = (children: ReactNode): boolean => {
    const first = firstMeaningfulChild(children);
    if (first === null || !isValidElement(first)) return false;
    if (isSourceNoteLabel(first)) return true;
    // blockquote > p (= 本 map の P) > [strong, text] の 1 段だけ降りる
    const inner = firstMeaningfulChild((first.props as { children?: ReactNode }).children);
    return isSourceNoteLabel(inner);
  };

  function Blockquote({ children, ...props }: ComponentProps<"blockquote">) {
    if (startsWithSourceNoteLabel(children)) {
      return (
        <aside
          data-source-note=""
          className="not-prose my-8 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-[0.8125rem] leading-relaxed text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 [&_p]:m-0 [&_strong]:mr-1 [&_strong]:font-semibold [&_strong]:text-neutral-700 dark:[&_strong]:text-neutral-300"
        >
          {children}
        </aside>
      );
    }
    return <blockquote {...props}>{children}</blockquote>;
  }

  return { h2: H2, p: P, blockquote: Blockquote };
}
