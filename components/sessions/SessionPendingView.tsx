import type { SessionRecord } from "@/lib/sessions/session-content";

export interface SessionPendingCopy {
  snapshotHeading: string;
  highlightsHeading: string;
  watchHeading: string;
  crystallizeNote: string;
}

/** Pending same-URL view. Editorial is deliberately JA-only for this gate. */
export function SessionPendingView({
  record,
  locale,
  copy,
}: {
  record: SessionRecord;
  locale: string;
  copy: SessionPendingCopy;
}) {
  const editorial = locale === "ja" ? record.editorial : undefined;
  return (
    <div className="mt-6 space-y-7">
      {editorial ? (
        <p className="text-base leading-8 text-text-primary">
          {editorial.lead}
        </p>
      ) : null}

      <section>
        {editorial ? (
          <h2 className="text-sm font-bold text-text-primary">
            {copy.snapshotHeading}
          </h2>
        ) : null}
        <ul className="mt-3 space-y-3 text-[15px] text-text-primary">
          {record.bullets.map((bullet) => (
            <li
              key={bullet}
              className="border-b border-dashed border-border-primary pb-3"
            >
              {bullet}
            </li>
          ))}
        </ul>
      </section>

      {editorial ? (
        <>
          <section>
            <h2 className="text-sm font-bold text-text-primary">
              {copy.highlightsHeading}
            </h2>
            {editorial.items.length > 0 ? (
              <ol className="mt-3 space-y-4">
                {editorial.items.map((item) => (
                  <li
                    key={`${item.sourceUrl}:${item.headline}`}
                    className="border-l-2 border-l-accent pl-4"
                  >
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-accent hover:underline"
                    >
                      {item.headline}
                    </a>
                    {item.note ? (
                      <p className="mt-1 text-sm leading-6 text-text-secondary">
                        {item.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
          <section>
            <h2 className="text-sm font-bold text-text-primary">
              {copy.watchHeading}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-primary">
              {editorial.watch.map((watch) => (
                <li key={watch}>{watch}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {record.articleStatus === "pending" ? (
        <p className="text-sm text-text-tertiary">{copy.crystallizeNote}</p>
      ) : null}
    </div>
  );
}
