import {
  terminalPreviewAdapterFixtureMock,
  terminalPreviewAdapterFixturePacket,
} from "@/lib/livemakers-terminal-preview/adapter-fixture-data";
import type { TerminalPreviewMock } from "@/lib/livemakers-terminal-preview/types";

export type ReviewedReaderTerminalSourceMode = "fixture_only";
export type ReviewedReaderTerminalReviewStatus = "reviewed_fixture";

export interface ReviewedReaderTerminalSourceSnapshot {
  sourceId: "reader_terminal.homepage.reviewed_fixture_source.g33";
  sourceMode: ReviewedReaderTerminalSourceMode;
  reviewStatus: ReviewedReaderTerminalReviewStatus;
  packetId: string;
  generatedAt: string;
  reviewedAt: string;
  data: TerminalPreviewMock;
}

function requiredReviewedTimestamp(value: string | null, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Reviewed reader terminal source missing ${label}`);
  }

  return value;
}

export function getReviewedReaderTerminalSource(): ReviewedReaderTerminalSourceSnapshot {
  return {
    sourceId: "reader_terminal.homepage.reviewed_fixture_source.g33",
    sourceMode: "fixture_only",
    reviewStatus: "reviewed_fixture",
    packetId: terminalPreviewAdapterFixturePacket.packet_id,
    generatedAt: requiredReviewedTimestamp(
      terminalPreviewAdapterFixturePacket.generated_at,
      "generated_at",
    ),
    reviewedAt: requiredReviewedTimestamp(
      terminalPreviewAdapterFixturePacket.reviewed_at,
      "reviewed_at",
    ),
    data: terminalPreviewAdapterFixtureMock,
  };
}
