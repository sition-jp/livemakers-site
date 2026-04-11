export function LogoSvg({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
    >
      <path d="M50 8 L92 50 L50 92 L8 50 Z" />
      <path d="M68 28 L32 28 L32 48 L68 48 L68 68 L32 68" />
    </svg>
  );
}
