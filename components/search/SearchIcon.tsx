/** 虫眼鏡 (ヘッダー 🔍 ボタン・検索バー・検索ページで共用)。currentColor で文字色に従う。 */
export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      className={className}
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.6 12.6 17 17" strokeLinecap="round" />
    </svg>
  );
}
