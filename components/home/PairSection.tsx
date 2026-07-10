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
      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div>{left}</div>
        <div className="flex items-center justify-center gap-2 py-1 text-[10px] font-bold tracking-label text-text-tertiary md:flex-col md:self-stretch md:py-4 [writing-mode:horizontal-tb] md:[writing-mode:vertical-rl]">
          <span className="text-base [writing-mode:horizontal-tb]">⇄</span>
          <span>{jointLabel}</span>
        </div>
        <div>{right}</div>
      </div>
    </section>
  );
}
