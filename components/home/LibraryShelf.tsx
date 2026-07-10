import type {
  ArticleFamily,
  ArticleMeta,
} from "@/lib/articles/article-model";
import { Link } from "@/i18n/navigation";
import { ArticleCardSmall } from "./ArticleCardSmall";

export interface LibraryShelfCopy {
  familyLabels: Record<ArticleFamily, string>;
  archiveTitle: string;
  archiveNote: string;
}

export function LibraryShelf({
  articles,
  copy,
}: {
  articles: ArticleMeta[];
  copy: LibraryShelfCopy;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {articles.map((article) => (
        <ArticleCardSmall
          key={article.articleId}
          article={article}
          familyLabel={copy.familyLabels[article.family]}
        />
      ))}
      <Link
        href="/sessions/archive"
        data-index-nav
        className="group block border border-border-primary bg-bg-secondary p-3 transition-colors hover:border-border-hover"
      >
        <h3 className="text-sm font-semibold leading-snug text-text-primary group-hover:underline">
          {copy.archiveTitle}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
          {copy.archiveNote}
        </p>
      </Link>
    </div>
  );
}
