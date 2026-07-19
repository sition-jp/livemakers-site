import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isArticleInflowPreviewEnabled } from "@/lib/articles/article-inflow-feed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "LiveMakers Article Inflow Preview",
  robots: { index: false, follow: false },
};

export default function ArticleInflowPreviewLayout({ children }: { children: React.ReactNode }) {
  if (!isArticleInflowPreviewEnabled()) notFound();
  return children;
}
