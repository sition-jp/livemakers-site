import type { ComponentProps } from "react";

import { SourceCard } from "@/components/articles/SourceCard";

type Props = ComponentProps<"li"> & {
  "data-source-url"?: string;
  "data-source-label"?: string;
};

/** 出典節の `li` — remark (source-links) が目印を付けた項目だけ小さいカードにする。 */
export function SourceCardListItem({
  children,
  "data-source-url": url,
  "data-source-label": label,
  ...rest
}: Props) {
  if (!url || !label) return <li {...rest}>{children}</li>;
  return (
    <li {...rest} className="my-2.5 list-none ps-0">
      <SourceCard url={url} label={label} size="small" />
    </li>
  );
}
