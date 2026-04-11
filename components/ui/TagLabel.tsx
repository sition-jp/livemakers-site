export function TagLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block border border-border-primary px-3 py-1 text-[10px] tracking-label text-text-secondary uppercase">
      {children}
    </span>
  );
}
