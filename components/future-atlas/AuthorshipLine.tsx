import type { ManifestEntry } from "@/lib/future-atlas/schema";

const AUTHORSHIP_COPY: Record<ManifestEntry["authorshipMode"], string> = {
  human_written: "執筆: 田平茂樹 · 調査・検証補助にAIを使用",
  ai_draft_human_edited: "AI下書き · 田平茂樹が編集・検証・承認",
};

export function AuthorshipLine({
  authorshipMode,
}: {
  authorshipMode: ManifestEntry["authorshipMode"];
}) {
  return (
    <p data-atlas-authorship className="mb-4 text-sm text-text-secondary">
      {AUTHORSHIP_COPY[authorshipMode]}
    </p>
  );
}
