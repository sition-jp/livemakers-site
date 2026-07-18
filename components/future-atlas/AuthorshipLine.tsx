import { useTranslations } from "next-intl";

import type { ManifestEntry } from "@/lib/future-atlas/schema";

export function AuthorshipLine({
  authorshipMode,
}: {
  authorshipMode: ManifestEntry["authorshipMode"];
}) {
  const t = useTranslations("futureAtlas.authorship");

  return (
    <p data-atlas-authorship className="mb-4 text-sm text-text-secondary">
      {t(authorshipMode)}
    </p>
  );
}
