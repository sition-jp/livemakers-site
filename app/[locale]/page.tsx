import { setRequestLocale } from "next-intl/server";

export default async function Placeholder({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-7xl px-6 py-24 text-center text-text-tertiary">
      Placeholder — Task 8 replaces this.
    </div>
  );
}
