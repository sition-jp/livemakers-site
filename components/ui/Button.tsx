import { Link } from "@/i18n/navigation";

export function Button({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const className =
    "inline-block border border-pillar-overview px-6 py-3 text-xs tracking-label text-text-primary hover:bg-pillar-overview hover:text-bg-primary transition-colors";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
