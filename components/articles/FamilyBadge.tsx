import type { CSSProperties } from "react";

import { Link } from "@/i18n/navigation";
import type { ArticleFamily } from "@/lib/articles/article-model";
import { familyMark } from "@/lib/articles/family-mark";

/**
 * 種類のバッジ (2026-11-16 題のラベルを外す設計 §5)。
 *
 * 種類の名前 (`messages/*.json` の `articles.family`) の前に印
 * (lib/articles/family-mark.ts) を付けて出す。印は飾りなので読み上げない
 * (aria-hidden)。名前は 1 回だけ読まれる。
 *
 * `href` を渡すとリンクになる。記事ページのバッジだけがシリーズの一覧への
 * リンクを持つ。カードはカード全体がリンクなので、カードの中では `href` を
 * 渡さない (リンクの中にリンクを入れない)。見た目 (色・大きさ) は呼ぶ側が
 * `className` / `style` で今までどおり決める。
 */
export function FamilyBadge({
  family,
  label,
  href,
  className,
  style,
  testId,
}: {
  family: ArticleFamily;
  label: string;
  href?: string;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}) {
  const mark = familyMark(family);
  const content = (
    <>
      {mark ? (
        <>
          <span aria-hidden="true" data-family-mark="">
            {mark}
          </span>{" "}
        </>
      ) : null}
      {label}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        data-family-badge={family}
        data-testid={testId}
        className={className}
        style={style}
      >
        {content}
      </Link>
    );
  }
  return (
    <span data-family-badge={family} data-testid={testId} className={className} style={style}>
      {content}
    </span>
  );
}
