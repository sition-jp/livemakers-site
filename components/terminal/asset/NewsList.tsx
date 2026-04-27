/**
 * NewsList — top N news entries scoped to the current asset.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §5.1
 */
import { useTranslations } from "next-intl";
import type { AssetNewsRef } from "@/lib/terminal/asset-summary";

interface NewsListProps {
  asset: string;
  total: number;
  items: AssetNewsRef[];
}

const ACCOUNT_LABEL: Record<string, string> = {
  SITIONjp: "@SITIONjp",
  SIPO_Tokyo: "@SIPO_Tokyo",
  LifeMakersCom: "@LifeMakersCom",
};

function relTime(isoUtc: string): string {
  const ms = Date.now() - new Date(isoUtc).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export function NewsList({ asset, total, items }: NewsListProps) {
  const t = useTranslations("assets.news");

  if (items.length === 0) {
    return (
      <section
        className="rounded-lg border border-border-primary bg-bg-secondary p-6"
        aria-label={t("title")}
      >
        <header className="mb-4">
          <h2 className="text-xs uppercase tracking-label text-text-tertiary">
            {t("title")}
          </h2>
        </header>
        <p className="text-sm text-text-secondary">{t("none", { asset })}</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-border-primary bg-bg-secondary p-6"
      aria-label={t("title")}
    >
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-label text-text-tertiary">
          {t("title")}
        </h2>
        <span className="text-[11px] uppercase tracking-label text-text-tertiary">
          {t("total", { n: total })}
        </span>
      </header>
      <ul className="space-y-3">
        {items.map((n) => (
          <li
            key={n.id}
            className="rounded-md border border-transparent p-3 transition-colors hover:border-border-hover hover:bg-bg-tertiary"
          >
            <a
              href={n.href_internal ?? n.source_url}
              target={n.href_internal ? "_self" : "_blank"}
              rel={n.href_internal ? undefined : "noopener noreferrer"}
              className="block"
            >
              <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-label text-text-tertiary">
                {n.account_tag && (
                  <>
                    <span className="text-pillar-overview">
                      {ACCOUNT_LABEL[n.account_tag]}
                    </span>
                    <span>·</span>
                  </>
                )}
                {n.source_handle && (
                  <>
                    <span>{n.source_handle}</span>
                    <span>·</span>
                  </>
                )}
                <span>{relTime(n.published_at)} ago</span>
              </div>
              <div className="text-sm text-text-primary">{n.title}</div>
              <div className="mt-1 text-xs text-text-tertiary">{n.summary}</div>
            </a>
          </li>
        ))}
      </ul>
      <div data-testid={`news-asset-${asset}`} className="sr-only">
        {asset}
      </div>
    </section>
  );
}
