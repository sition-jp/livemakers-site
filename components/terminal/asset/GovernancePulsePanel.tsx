/**
 * GovernancePulsePanel — ADA detail page core differentiator.
 *
 * Renders active Cardano governance actions with SIPO's stance, evidence,
 * risk assessment, and treasury impact. Includes the SIPO DRep card.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §6
 */
import { useTranslations } from "next-intl";
import type {
  GovernanceAction,
  GovernancePulse,
  DRepCard,
} from "@/lib/terminal/asset-summary";

interface GovernancePulsePanelProps {
  pulse: GovernancePulse;
}

const DECISION_COLOR: Record<string, string> = {
  yes: "text-status-up bg-status-up/10",
  no: "text-status-down bg-status-down/10",
  abstain: "text-text-secondary bg-text-secondary/10",
  pending: "text-pillar-governance bg-pillar-governance/10",
};

const STATUS_COLOR: Record<string, string> = {
  voting: "text-pillar-governance bg-pillar-governance/10",
  ratified: "text-status-up bg-status-up/10",
  enacted: "text-status-up bg-status-up/10",
  expired: "text-text-tertiary bg-text-tertiary/10",
  withdrawn: "text-text-tertiary bg-text-tertiary/10",
};

function ActionCard({ action }: { action: GovernanceAction }) {
  const t = useTranslations("assets.governance.action");
  const stance = action.sipo_stance;

  return (
    <article className="rounded-lg border border-border-primary bg-bg-tertiary p-5">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-label">
            <span
              className={`rounded px-2 py-0.5 ${
                STATUS_COLOR[action.status] ?? ""
              }`}
            >
              {t(action.status as never)}
            </span>
            <span className="text-text-tertiary">
              {action.action_type.replaceAll("_", " ")}
            </span>
            {action.expires_at && (
              <span className="text-text-tertiary">
                · {t("expires")} {action.expires_at.split("T")[0]}
              </span>
            )}
          </div>
          <h3 className="text-base font-medium text-text-primary">
            {action.title_ja}
          </h3>
          <p className="mt-1 text-xs text-text-tertiary">{action.title_en}</p>
        </div>
      </header>

      {/* Tally */}
      <div className="mb-4 rounded border border-border-primary bg-bg-secondary p-3">
        <div className="mb-2 text-[11px] uppercase tracking-label text-text-tertiary">
          {t("tally")}
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-text-tertiary text-xs">
              {t("tally_drep_yes")}
            </div>
            <div className="text-status-up font-medium">
              {action.current_tally.drep_yes_pct.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-text-tertiary text-xs">
              {t("tally_drep_no")}
            </div>
            <div className="text-status-down font-medium">
              {action.current_tally.drep_no_pct.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-text-tertiary text-xs">
              {t("tally_drep_abstain")}
            </div>
            <div className="text-text-secondary font-medium">
              {action.current_tally.drep_abstain_pct.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* SIPO stance */}
      {stance && (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-label text-text-tertiary">
              {t("sipo_stance")}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[11px] uppercase tracking-label ${
                DECISION_COLOR[stance.decision] ?? ""
              }`}
            >
              {t(stance.decision as never)}
            </span>
          </div>
          <p className="mb-3 text-sm text-text-primary">
            {stance.rationale_ja}
          </p>
          {stance.risk_assessment && (
            <div className="mb-2 text-xs text-text-secondary">
              <span className="uppercase tracking-label text-text-tertiary">
                {t("risk")}:
              </span>{" "}
              {stance.risk_assessment}
            </div>
          )}
          {stance.treasury_impact_ada !== null && (
            <div className="mb-2 text-xs text-text-secondary">
              <span className="uppercase tracking-label text-text-tertiary">
                {t("treasury_impact")}:
              </span>{" "}
              {t("treasury_impact_unit")}
              {Math.abs(stance.treasury_impact_ada).toLocaleString("en-US")}
              {stance.treasury_impact_ada < 0 ? " (out)" : " (in)"}
            </div>
          )}
          {stance.evidence.length > 0 && (
            <details className="text-xs text-text-secondary">
              <summary className="cursor-pointer uppercase tracking-label text-text-tertiary">
                {t("evidence")} ({stance.evidence.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {stance.evidence.map((e, i) => (
                  <li key={i}>
                    <a
                      href={e.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pillar-overview hover:underline"
                    >
                      {e.snippet}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Footer links */}
      <footer className="mt-4 flex flex-wrap gap-3 text-[11px] uppercase tracking-label">
        <a
          href={action.links.gov_tools_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-pillar-overview hover:underline"
        >
          {t("gov_tools")} →
        </a>
        {action.links.cardano_forum_url && (
          <a
            href={action.links.cardano_forum_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pillar-overview hover:underline"
          >
            {t("forum")} →
          </a>
        )}
        {action.links.intersect_url && (
          <a
            href={action.links.intersect_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pillar-overview hover:underline"
          >
            {t("intersect")} →
          </a>
        )}
      </footer>
    </article>
  );
}

function DRepCardView({ card }: { card: DRepCard }) {
  const t = useTranslations("assets.governance.drep_card");
  return (
    <aside
      className="rounded-lg border border-pillar-governance/30 bg-bg-tertiary p-5"
      aria-label={t("title")}
    >
      <h3 className="mb-3 text-xs uppercase tracking-label text-pillar-governance">
        {t("title")}
      </h3>
      <div className="mb-2 text-2xl font-light tracking-title">
        {card.display_name}
      </div>
      <div className="mb-3 text-xs uppercase tracking-label text-text-secondary">
        {card.rank != null
          ? t("rank", { n: card.rank })
          : t("rank_unknown")}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-text-secondary">
        <div className="flex flex-col">
          <dt className="text-text-tertiary uppercase tracking-label">
            {t("delegators", {
              n: card.delegators.toLocaleString("en-US"),
            })}
          </dt>
        </div>
        <div className="flex flex-col">
          <dt className="text-text-tertiary uppercase tracking-label">
            {t("delegated_ada", {
              n: (card.delegated_ada / 1_000_000).toFixed(1) + "M",
            })}
          </dt>
        </div>
        <div className="flex flex-col">
          <dt className="text-text-tertiary uppercase tracking-label">
            {card.voting_power_pct != null
              ? t("voting_power", {
                  pct: card.voting_power_pct.toFixed(2),
                })
              : "—"}
          </dt>
        </div>
        <div className="flex flex-col">
          <dt className="text-text-tertiary uppercase tracking-label">
            {t("recent_votes", { n: card.recent_votes_count })}
          </dt>
        </div>
      </dl>
      <a
        href={card.sition_profile_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block text-xs text-pillar-overview hover:underline"
      >
        {t("view_profile")}
      </a>
    </aside>
  );
}

export function GovernancePulsePanel({ pulse }: GovernancePulsePanelProps) {
  const t = useTranslations("assets.governance");

  return (
    <section
      className="rounded-lg border border-pillar-governance/30 bg-bg-secondary p-6"
      aria-label={t("title")}
    >
      <header className="mb-6">
        <h2 className="mb-1 text-base font-medium tracking-title text-pillar-governance">
          {t("title")}
        </h2>
        <p className="text-xs text-text-tertiary">{t("subtitle")}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-xs uppercase tracking-label text-text-tertiary">
              {t("active_actions")} ({pulse.active_actions.length})
            </h3>
            {pulse.active_actions.length === 0 ? (
              <p className="text-sm text-text-secondary">{t("no_active")}</p>
            ) : (
              <div className="space-y-4">
                {pulse.active_actions.map((a) => (
                  <ActionCard key={a.action_id} action={a} />
                ))}
              </div>
            )}
          </div>
          {pulse.recently_resolved.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs uppercase tracking-label text-text-tertiary">
                {t("recently_resolved")} ({pulse.recently_resolved.length})
              </h3>
              <div className="space-y-4">
                {pulse.recently_resolved.map((a) => (
                  <ActionCard key={a.action_id} action={a} />
                ))}
              </div>
            </div>
          )}
        </div>
        <DRepCardView card={pulse.drep_card} />
      </div>
    </section>
  );
}
