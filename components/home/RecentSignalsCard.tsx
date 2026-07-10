import type { ArticleMeta } from "@/lib/articles/article-model";
import { ArticleRow } from "./ArticleRow";

export interface RecentSignalsCopy {
  title: string;
  subtitle: string;
  familyLabel: string;
}

export function RecentSignalsCard({
  articles,
  copy,
}: {
  articles: ArticleMeta[];
  copy: RecentSignalsCopy;
}) {
  return (
    <section className="rounded-lg border border-border-primary bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">{copy.title}</h3>
      <p className="mt-1 text-[11px] text-text-tertiary">
        {copy.subtitle}
      </p>
      <div className="mt-3 border-t border-border-primary">
        {articles.map((article) => (
          <ArticleRow
            key={article.articleId}
            article={article}
            familyLabel={copy.familyLabel}
          />
        ))}
      </div>
    </section>
  );
}
