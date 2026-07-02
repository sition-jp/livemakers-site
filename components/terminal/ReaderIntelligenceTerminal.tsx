import { Link } from "@/i18n/navigation";
import type { ReviewedReaderTerminalSourceProvenance } from "@/lib/livemakers-terminal-preview/reader-terminal-source";
import type {
  LocalizedText,
  TerminalPreviewLocale,
  TerminalPreviewMock,
} from "@/lib/livemakers-terminal-preview/types";

export interface ReaderIntelligenceTerminalCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  currentStateTitle: string;
  sourceStatusTitle: string;
  sourceStatusReviewed: string;
  sourceStatusFixtureOnly: string;
  sourceStatusReviewedAt: string;
  sourceStatusPacket: string;
}

function pick(text: LocalizedText, locale: TerminalPreviewLocale): string {
  return locale === "ja" ? text.ja : text.en;
}

export function ReaderIntelligenceTerminal({
  locale,
  data,
  copy,
  sourceProvenance,
}: {
  locale: TerminalPreviewLocale;
  data: TerminalPreviewMock;
  copy: ReaderIntelligenceTerminalCopy;
  sourceProvenance?: ReviewedReaderTerminalSourceProvenance;
}) {
  const { liveRadar, articleNewsFeed } = data.publicTopology;

  return (
    <section
      aria-labelledby="reader-intelligence-terminal-title"
      className="mx-auto max-w-7xl px-6 py-10"
    >
      <div className="border-y border-border-primary py-6">
        <div className="grid gap-8">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                {copy.eyebrow}
              </p>
              <h2
                id="reader-intelligence-terminal-title"
                className="text-3xl font-light leading-tight text-text-primary md:text-4xl"
              >
                {copy.title}
              </h2>
            </div>
            <div className="grid gap-3">
              <p className="text-sm leading-relaxed text-text-secondary">
                {copy.subtitle}
              </p>
              <p className="font-mono text-[11px] text-text-tertiary">
                {data.terminalState.asOfJst}
              </p>
              {sourceProvenance && (
                <div
                  aria-label={copy.sourceStatusTitle}
                  className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-label text-text-tertiary"
                >
                  <span className="text-text-secondary">
                    {copy.sourceStatusTitle}
                  </span>
                  <span className="border border-border-primary px-2 py-0.5 text-pillar-overview">
                    {copy.sourceStatusReviewed}
                  </span>
                  <span className="border border-border-primary px-2 py-0.5">
                    {copy.sourceStatusFixtureOnly}
                  </span>
                  <span className="font-mono normal-case tracking-normal">
                    {copy.sourceStatusReviewedAt} {sourceProvenance.reviewedAt}
                  </span>
                  <span className="font-mono normal-case tracking-normal">
                    {copy.sourceStatusPacket} {sourceProvenance.packetId}
                  </span>
                </div>
              )}
            </div>
          </div>

          <section className="border border-border-primary bg-bg-secondary/40 p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-label text-text-tertiary">
              {copy.currentStateTitle}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.indicators.map((indicator) => (
                <article
                  key={indicator.id}
                  className="border border-border-primary bg-bg-primary p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                      {indicator.label}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-label text-pillar-overview">
                      {indicator.freshness}
                    </span>
                  </div>
                  <p className="mb-2 text-lg font-light text-text-primary">
                    {indicator.value}
                  </p>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {pick(indicator.note, locale)}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="border border-border-primary bg-bg-primary p-5">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-label text-text-tertiary">
                {pick(liveRadar.title, locale)}
              </h3>
              <div className="space-y-3">
                {liveRadar.items.map((item) => (
                  <article
                    key={item.id}
                    className="border border-border-primary bg-bg-secondary/40 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="border border-border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                        {pick(item.sourceLabel, locale)}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-label text-pillar-market">
                        {item.family}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold leading-snug text-text-primary">
                      {pick(item.title, locale)}
                    </h4>
                    <p className="text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                      {item.status}
                    </p>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                      {pick(item.freshnessLabel, locale)}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="border border-border-primary bg-bg-primary p-5">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-label text-text-tertiary">
                {pick(articleNewsFeed.title, locale)}
              </h3>
              <div className="divide-y divide-border-primary">
                {articleNewsFeed.items.map((item) => (
                  <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="border border-border-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label text-pillar-overview">
                        {item.family}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-label text-text-tertiary">
                        {item.publishedAt}
                      </span>
                    </div>
                    <Link href={item.href} className="block">
                      <h4 className="mb-2 text-sm font-semibold leading-snug text-text-primary">
                        {pick(item.title, locale)}
                      </h4>
                      <p className="text-sm leading-relaxed text-text-secondary">
                        {pick(item.excerpt, locale)}
                      </p>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
