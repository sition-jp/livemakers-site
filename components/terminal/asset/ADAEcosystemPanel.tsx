/**
 * ADAEcosystemPanel — DeFi + Epoch + Staking sections for the ADA detail page.
 *
 * Spec: 08_DOCS/knowledge/specs/2026-04-27-livemakers-terminal-asset-contract-v0.md §5.2
 */
import { useTranslations } from "next-intl";
import type { ADAExtension } from "@/lib/terminal/asset-summary";

interface ADAEcosystemPanelProps {
  extension: ADAExtension;
}

function formatCompactUSD(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPct(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function ADAEcosystemPanel({ extension }: ADAEcosystemPanelProps) {
  const tDefi = useTranslations("assets.ecosystem.defi");
  const tEpoch = useTranslations("assets.ecosystem.epoch");
  const tStake = useTranslations("assets.ecosystem.staking");
  const tWrap = useTranslations("assets.ecosystem");

  const { defi, epoch, staking } = extension;

  return (
    <section
      className="rounded-lg border border-pillar-ecosystem/30 bg-bg-secondary p-6"
      aria-label={tWrap("title")}
    >
      <header className="mb-6">
        <h2 className="text-base font-medium tracking-title text-pillar-ecosystem">
          {tWrap("title")}
        </h2>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* DeFi */}
        <div className="rounded-lg border border-border-primary bg-bg-tertiary p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-xs uppercase tracking-label text-text-tertiary">
              {tDefi("tvl")}
            </h3>
            {defi.tvl_change_7d_pct !== 0 && (
              <span
                className={`text-[11px] uppercase tracking-label ${
                  defi.tvl_change_7d_pct >= 0
                    ? "text-status-up"
                    : "text-status-down"
                }`}
              >
                {defi.tvl_change_7d_pct >= 0 ? "+" : ""}
                {defi.tvl_change_7d_pct.toFixed(1)}% {tDefi("tvl_change_7d")}
              </span>
            )}
          </div>
          <div className="mb-4 text-3xl font-light tracking-title">
            {defi.tvl_usd > 0 ? formatCompactUSD(defi.tvl_usd) : "—"}
          </div>
          {defi.top_protocols.length > 0 && (
            <>
              <div className="mb-2 text-[11px] uppercase tracking-label text-text-tertiary">
                {tDefi("top_protocols")}
              </div>
              <ol className="space-y-1 text-sm">
                {defi.top_protocols.slice(0, 5).map((p) => (
                  <li
                    key={p.name}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="text-text-primary">{p.name}</span>
                    <span className="font-mono text-xs text-text-secondary">
                      {formatCompactUSD(p.tvl_usd)}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        {/* Epoch */}
        <div className="rounded-lg border border-border-primary bg-bg-tertiary p-5">
          <h3 className="mb-4 text-xs uppercase tracking-label text-text-tertiary">
            {tEpoch("current")}
          </h3>
          <div className="mb-4 text-3xl font-light tracking-title">
            {epoch.current > 0 ? `#${epoch.current}` : "—"}
          </div>
          {epoch.current > 0 && (
            <>
              <div className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-label">
                <span className="text-text-tertiary">{tEpoch("progress")}</span>
                <span className="text-text-secondary">
                  {formatPct(epoch.progress_pct, 1)}
                </span>
              </div>
              <div className="mb-3 h-1.5 w-full rounded-full bg-bg-primary">
                <div
                  className="h-full rounded-full bg-pillar-governance"
                  style={{
                    width: `${Math.min(100, Math.max(0, epoch.progress_pct))}%`,
                  }}
                />
              </div>
              {epoch.boundary_eta && (
                <div className="text-[11px] uppercase tracking-label text-text-tertiary">
                  {tEpoch("boundary_eta")}{" "}
                  <span className="text-text-secondary">
                    {new Date(epoch.boundary_eta).toUTCString()}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Staking */}
        <div className="rounded-lg border border-border-primary bg-bg-tertiary p-5">
          <h3 className="mb-4 text-xs uppercase tracking-label text-text-tertiary">
            {tStake("active_pct")}
          </h3>
          <div className="mb-4 text-3xl font-light tracking-title">
            {staking.active_pct > 0 ? formatPct(staking.active_pct) : "—"}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-text-tertiary text-xs uppercase tracking-label">
                {tStake("nakamoto")}
              </dt>
              <dd className="font-mono text-text-primary">
                {staking.nakamoto_coefficient > 0
                  ? staking.nakamoto_coefficient
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
