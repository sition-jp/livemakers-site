import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { SnapshotChromeMeta } from "@/lib/home/market-snapshot";
import type { WindowProvenance } from "@/lib/provenance/window-provenance";
import type { ProvenanceLabels } from "./WindowProvenanceRow";

/**
 * ヘッダ 3 段目 (2026-08-14 田平氏指示で再構成):
 * 左 = 来歴 (審査状態/ソース/as-of/パケットID) + 注記「数値は取得時点の…」を
 * 続けて表示。右 = 旧ヘッダ 1 段目のクラスタ (LIGHT/DARK・日付・SNAPSHOT
 * チップ・version)。chromeMeta を渡さない呼び出し (テスト等) は従来表示。
 */
export function GlobalProvenanceStrip({
  provenance,
  labels,
  note,
  chromeMeta,
  snapshotLabel,
}: {
  provenance: WindowProvenance;
  labels: ProvenanceLabels;
  note: string;
  chromeMeta?: SnapshotChromeMeta;
  snapshotLabel?: string;
}) {
  return (
    <div
      data-chrome="provenance-strip"
      data-packet-id={provenance.packetId}
      className="border-b border-border-primary bg-bg-secondary text-[10.5px] text-text-tertiary"
    >
      {/* Same centered container as Header/TickerBar/Footer so the strip's
          edges align with the site chrome on wide viewports. */}
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
        <span>
          {labels.review}: <b className="font-bold text-text-primary">{provenance.reviewStatus}</b>
        </span>
        <span>
          {labels.source}: <b className="font-bold text-text-primary">{provenance.sourceMode}</b>
        </span>
        <span>
          {labels.asOf} <b className="font-mono">{provenance.asOfJst}</b>
        </span>
        <span>
          {labels.packet}: <b className="font-mono">{provenance.packetId}</b>
        </span>
        <span>{note}</span>
        {chromeMeta ? (
          <span className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <span className="hidden font-mono text-[10px] xl:inline">
              {chromeMeta.dateLabel}
            </span>
            <span className="max-w-[73px] overflow-hidden whitespace-nowrap rounded bg-bg-tertiary px-2 py-1 font-mono text-[9px] font-bold tracking-label text-text-secondary sm:max-w-none">
              {snapshotLabel} {chromeMeta.asOfLabel}
            </span>
            <span
              className="hidden text-[10px] tracking-label xl:inline"
              title={`build ${process.env.NEXT_PUBLIC_BUILD_SHA} · ${process.env.NEXT_PUBLIC_BUILD_DATE}`}
            >
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
