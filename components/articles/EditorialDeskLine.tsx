import { Link } from "@/i18n/navigation";

/**
 * 記事の署名 (2026-09-09 田平氏確定)。
 *
 * 読者に「誰が書いたか」を示す恒常表示。個人名は出さず、AI と人の分担は
 * about ページの「編集体制」節 (#editorial-desk) で説明する。
 *
 * future-atlas の連載は人が書く vision 記事なので、従来どおり
 * `AuthorshipLine` (個人名つき) を使い、本コンポーネントは表示しない。
 */
export function EditorialDeskLine({ label }: { label: string }) {
  return (
    <p data-article-desk="" className="mb-4 text-sm text-text-secondary">
      <Link
        href="/about#editorial-desk"
        className="border-b border-transparent transition-colors hover:border-current focus-visible:border-current"
      >
        {label}
      </Link>
    </p>
  );
}
