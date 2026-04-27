/**
 * NIGHTExtensionPanel — Midnight dApps + network status.
 */
import { useTranslations } from "next-intl";
import type { NIGHTExtension } from "@/lib/terminal/asset-summary";

interface NIGHTExtensionPanelProps {
  extension: NIGHTExtension;
}

function relTime(isoUtc: string | null): string {
  if (!isoUtc) return "—";
  const ms = Date.now() - new Date(isoUtc).getTime();
  if (Number.isNaN(ms)) return "—";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export function NIGHTExtensionPanel({ extension }: NIGHTExtensionPanelProps) {
  const t = useTranslations("assets.night_ext");

  return (
    <section
      className="rounded-lg border border-pillar-midnight/30 bg-bg-secondary p-6"
      aria-label={t("title")}
    >
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-medium tracking-title text-pillar-midnight">
            {t("title")}
          </h2>
          <p className="mt-1 text-xs text-text-tertiary">{t("subtitle")}</p>
        </div>
        <span className="text-[11px] uppercase tracking-label text-text-tertiary">
          {extension.source}
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* dApps */}
        <div className="rounded-md border border-border-primary bg-bg-tertiary p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[11px] uppercase tracking-label text-text-tertiary">
              {t("dapps_total")}
            </h3>
            <span className="text-2xl font-light tracking-title text-pillar-midnight">
              {extension.dapps.total_listed}
            </span>
          </div>
          <div className="mb-2 text-[11px] uppercase tracking-label text-text-tertiary">
            {t("recent_launches")}
          </div>
          {extension.dapps.recent_launches.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {t("no_recent_launches")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {extension.dapps.recent_launches.slice(0, 5).map((d) => (
                <li
                  key={d.url}
                  className="flex items-baseline justify-between gap-3"
                >
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-primary hover:text-pillar-midnight hover:underline"
                  >
                    {d.name}
                  </a>
                  <span className="font-mono text-xs text-text-tertiary">
                    {relTime(d.launched_at)} ago
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Network */}
        <div className="rounded-md border border-border-primary bg-bg-tertiary p-4">
          <h3 className="mb-3 text-[11px] uppercase tracking-label text-text-tertiary">
            {t("block_height")}
          </h3>
          <div className="mb-3 text-2xl font-light tracking-title">
            {extension.network.block_height != null
              ? extension.network.block_height.toLocaleString("en-US")
              : "—"}
          </div>
          <div className="text-[11px] uppercase tracking-label text-text-tertiary">
            {t("last_block_at")}{" "}
            <span className="text-text-secondary">
              {relTime(extension.network.last_block_at)} ago
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
