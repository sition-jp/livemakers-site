import type { ReactNode } from "react";

export function PairSection({
  title,
  left,
  right,
  jointLabel,
}: {
  title: string;
  left: ReactNode;
  right: ReactNode;
  jointLabel: string;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-lg font-bold text-text-primary">{title}</h2>
      {/* base 側にも minmax(0,1fr) + min-w-0 を張る: grid item の min-width:auto 既定だと
          12指標タイルの min-w-[660px] が 390px でトラックごと押し広げ、カード内
          overflow-x-auto が封じ込めに失敗する（T16 pinpoint・doctrine §4 制約3） */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="h-full min-w-0">{left}</div>
        <div className="flex items-center justify-center gap-2 py-1 text-[10px] font-bold tracking-label text-text-tertiary md:flex-col md:self-stretch md:py-4 [writing-mode:horizontal-tb] md:[writing-mode:vertical-rl]">
          <span className="text-base [writing-mode:horizontal-tb]">⇄</span>
          <span>{jointLabel}</span>
        </div>
        <div className="h-full min-w-0">{right}</div>
      </div>
    </section>
  );
}
