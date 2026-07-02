import type { TerminalAdapterPacket, TerminalAdapterSource } from "./types";

const displayableSourceIds = [
  "source.breaking_radar.xnews_fixture",
  "source.breaking_radar.personalized_trend_fixture",
  "source.breaking_radar.scheduled_crosscheck",
];

const internalManualSnapshotSourceId =
  "source.breaking_radar.manual_snapshot_internal";

function sourceById(
  packet: TerminalAdapterPacket,
  sourceId: string,
): TerminalAdapterSource | undefined {
  return packet.source_ledger.find((source) => source.source_id === sourceId);
}

function validateDisplayableFixtureSource(
  source: TerminalAdapterSource | undefined,
  sourceId: string,
): string[] {
  if (!source) {
    return [`${sourceId} must be present in Breaking Radar source ledger`];
  }

  const errors: string[] = [];
  if (
    source.source_kind !== "fixture" ||
    source.source_visibility !== "mock" ||
    source.source_confidence !== "mock" ||
    source.source_url_or_path !== null ||
    source.public_display_allowed !== true
  ) {
    errors.push(`${sourceId} must remain a mock fixture without URL/path`);
  }

  return errors;
}

function validateInternalManualSnapshot(
  source: TerminalAdapterSource | undefined,
): string[] {
  if (!source) {
    return [
      `${internalManualSnapshotSourceId} must be present in Breaking Radar source ledger`,
    ];
  }

  if (
    source.source_kind !== "fixture" ||
    source.source_visibility !== "internal_path" ||
    source.source_confidence !== "internal_only" ||
    source.source_url_or_path !== null ||
    source.public_display_allowed !== false
  ) {
    return [
      `${internalManualSnapshotSourceId} must remain internal_path/internal_only and not public-displayable`,
    ];
  }

  return [];
}

export function validateBreakingRadarFixtureProvenance(
  packet: TerminalAdapterPacket,
): string[] {
  const errors = displayableSourceIds.flatMap((sourceId) =>
    validateDisplayableFixtureSource(sourceById(packet, sourceId), sourceId),
  );

  errors.push(
    ...validateInternalManualSnapshot(
      sourceById(packet, internalManualSnapshotSourceId),
    ),
  );

  return errors;
}
