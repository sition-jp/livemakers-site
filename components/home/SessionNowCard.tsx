import { Link } from "@/i18n/navigation";
import type { SessionRecord } from "@/lib/sessions/session-content";
import { getSessionBySlug } from "@/lib/sessions/session-registry";
import type { WindowProvenance } from "@/lib/provenance/window-provenance";
import {
  WindowProvenanceRow,
  type ProvenanceLabels,
} from "./WindowProvenanceRow";

export interface SessionNowCopy {
  sessionBadgeSuffix: string;
  /** 2026-08-23 (spec §A): closed variant のバッジ末尾 ("JST 終了")。 */
  closedBadgeSuffix?: string;
  /** 2026-08-23 digest-only (observationStatus=absent): バッジ末尾 / 鮮度接頭 / 来歴の代替注記 */
  digestOnlyLabel?: string;
  digestFreshnessPrefix?: string;
  noSnapshotNote?: string;
  freshnessPrefix: string;
  nextUpdateLine: string;
  readFull: string;
  editorialPrefix: string;
  editorialSuffix: string;
  provenance: ProvenanceLabels;
}

export function firstLeadSentences(lead: string, limit = 2): string {
  return (
    lead
      .match(/[^。！？!?]+[。！？!?]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, limit)
      .join("") ?? lead
  );
}

export function SessionNowCard({
  record,
  provenance,
  copy,
  showEditorial = true,
  variant = "live",
}: {
  record: SessionRecord;
  provenance: WindowProvenance;
  copy: SessionNowCopy;
  showEditorial?: boolean;
  /**
   * 2026-08-23 田平氏 GO (spec 2026-08-23-terminal-switching-ux-design §A):
   * "closed" = 直前に終わったセッション (live が無い窓の埋め草)。本文は live と
   * 同じ・バッジだけ「終了」。live を示す語は出さない。
   */
  variant?: "live" | "closed";
}) {
  const definition = getSessionBySlug(record.sessionSlug);
  // 2026-08-23 田平氏 GO (spec 2026-08-23-digest-only-session-design §5):
  // 市場観測 RED の窓で読み解き digest だけから組まれたセッション。数値が
  // 無いので市場来歴 (reviewed_live 等) を主張せず、注記 1 行に置き換える。
  const digestOnly = record.observationStatus === "absent";
  const [headline, ...restBullets] = record.bullets;
  const freshnessHm = record.asOfJst.slice(11, 16);
  const editorial = showEditorial ? record.editorial : undefined;
  // 2026-08-23 (田平氏 GO): the full-session CTA always targets the
  // session's own URL. The D6 archive detour (below, kept as history) was
  // written before P2-LVM-IT-G1 added the same-URL live view — today
  // app/[locale]/sessions/[slug] resolves feed-origin records through
  // resolveSessionPageRecord, so a feed record shown on the home card can
  // never 404 at currentUrl while it is in the feed. Sending readers to
  // /sessions/archive instead landed them on a stale list (8/13 when the
  // crystallize auto-PR had been silently failing for 9 days).
  const sessionHref = record.currentUrl;
  return (
    <section
      aria-label={definition.nameEn}
      data-session-state={variant}
      data-session-observation={digestOnly ? "absent" : "green"}
      data-session-editorial={editorial ? "present" : "absent"}
      className="rounded-lg border border-border-primary border-l-4 border-l-accent bg-bg-secondary p-4"
    >
      <div className="flex items-center gap-2.5">
        <span className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] font-bold text-text-secondary">
          {definition.nameEn}
        </span>
        <span className="ml-auto rounded bg-accent px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white">
          SESSION · {definition.updateTimeLabel}{" "}
          {variant === "closed"
            ? (copy.closedBadgeSuffix ?? copy.sessionBadgeSuffix)
            : copy.sessionBadgeSuffix}
          {digestOnly && copy.digestOnlyLabel ? ` · ${copy.digestOnlyLabel}` : ""}
        </span>
      </div>
      <h3 className="mt-2 text-base font-bold leading-snug text-text-primary">
        {headline}
      </h3>
      <p className="mt-0.5 text-[11.5px] text-text-tertiary">
        {definition.nameJa}
      </p>
      <p className="mt-1 font-mono text-[11px] text-text-tertiary">
        {digestOnly ? (copy.digestFreshnessPrefix ?? copy.freshnessPrefix) : copy.freshnessPrefix}{" "}
        {record.date} · {freshnessHm} JST
      </p>
      {editorial ? (
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          {firstLeadSentences(editorial.lead)}
        </p>
      ) : null}
      <ul className="mt-2 text-[13px] text-text-primary">
        {restBullets.map((bullet, index) => (
          <li
            key={bullet}
            className={`border-b border-dashed border-border-primary py-1.5 last:border-b-0 ${
              index >= 1 ? "hidden md:list-item" : ""
            }`}
          >
            {bullet}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-3 text-[11.5px] text-text-tertiary">
        <span>{copy.nextUpdateLine}</span>
        {/* D6 (G43-e / fix round 2 I-2) used to route feed-lifted records
            without a materialized repo route to /sessions/archive. Retired
            2026-08-23 — see the sessionHref comment above. */}
        <Link
          href={sessionHref}
          className="ml-auto shrink-0 text-[12.5px] font-bold text-accent"
        >
          {editorial
            ? `${copy.editorialPrefix} ${editorial.items.length} ${copy.editorialSuffix}`
            : copy.readFull}
        </Link>
      </div>
      {digestOnly ? (
        <p className="mt-2 border-t border-dashed border-border-primary pt-1.5 text-[9.5px] text-text-tertiary">
          {copy.noSnapshotNote}
        </p>
      ) : (
        <WindowProvenanceRow
          provenance={provenance}
          labels={copy.provenance}
        />
      )}
    </section>
  );
}
