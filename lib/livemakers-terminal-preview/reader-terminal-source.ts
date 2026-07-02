import {
  terminalPreviewAdapterFixtureMock,
  terminalPreviewAdapterFixturePacket,
} from "@/lib/livemakers-terminal-preview/adapter-fixture-data";
import { getScheduledSessionVisibility } from "@/lib/livemakers-terminal-preview/scheduled-session-visibility";
import type { TerminalAdapterPacket } from "@/lib/livemakers-terminal-adapter/types";
import type { TerminalPreviewMock } from "@/lib/livemakers-terminal-preview/types";

export type ReviewedReaderTerminalSourceMode = "fixture_only";
export type ReviewedReaderTerminalReviewStatus = "reviewed_fixture";

export interface ReviewedReaderTerminalSourceProvenance {
  packetId: string;
  sourceMode: ReviewedReaderTerminalSourceMode;
  reviewStatus: ReviewedReaderTerminalReviewStatus;
  reviewedAt: string;
}

export interface ReviewedReaderTerminalSourceSnapshot {
  sourceId: "reader_terminal.homepage.reviewed_fixture_source.g33";
  sourceMode: ReviewedReaderTerminalSourceMode;
  reviewStatus: ReviewedReaderTerminalReviewStatus;
  packetId: string;
  generatedAt: string;
  reviewedAt: string;
  provenance: ReviewedReaderTerminalSourceProvenance;
  data: TerminalPreviewMock;
}

type ReviewedReaderTerminalSourcePacket = Pick<
  TerminalAdapterPacket,
  "packet_id" | "generated_at" | "reviewed_at"
>;

interface ReviewedReaderTerminalSourceOptions {
  packet?: ReviewedReaderTerminalSourcePacket;
}

function requiredReviewedTimestamp(value: string | null, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Reviewed reader terminal source missing ${label}`);
  }

  return value;
}

export function getReviewedReaderTerminalSource(
  options: ReviewedReaderTerminalSourceOptions = {},
): ReviewedReaderTerminalSourceSnapshot {
  const packet = options.packet ?? terminalPreviewAdapterFixturePacket;
  const reviewedAt = requiredReviewedTimestamp(packet.reviewed_at, "reviewed_at");
  const data: TerminalPreviewMock = {
    ...terminalPreviewAdapterFixtureMock,
    publicTopology: {
      ...terminalPreviewAdapterFixtureMock.publicTopology,
      scheduledSessionVisibility: getScheduledSessionVisibility(),
    },
  };

  return {
    sourceId: "reader_terminal.homepage.reviewed_fixture_source.g33",
    sourceMode: "fixture_only",
    reviewStatus: "reviewed_fixture",
    packetId: packet.packet_id,
    generatedAt: requiredReviewedTimestamp(
      packet.generated_at,
      "generated_at",
    ),
    reviewedAt,
    provenance: {
      packetId: packet.packet_id,
      sourceMode: "fixture_only",
      reviewStatus: "reviewed_fixture",
      reviewedAt,
    },
    data,
  };
}
