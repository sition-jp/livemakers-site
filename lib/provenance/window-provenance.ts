export type ProvenanceState =
  | {
      sourceMode: "fixture_only";
      reviewStatus: "reviewed_fixture";
    }
  | {
      sourceMode: "reviewed_live";
      reviewStatus: "reviewed_snapshot";
    };

export type WindowProvenance = ProvenanceState & {
  packetId: string;
  asOfJst: string;
};

function isValidProvenancePair(
  provenance: Pick<WindowProvenance, "sourceMode" | "reviewStatus">,
): boolean {
  return (
    (provenance.sourceMode === "fixture_only" &&
      provenance.reviewStatus === "reviewed_fixture") ||
    (provenance.sourceMode === "reviewed_live" &&
      provenance.reviewStatus === "reviewed_snapshot")
  );
}

export function makeWindowProvenance(
  provenance: WindowProvenance,
): WindowProvenance {
  if (!isValidProvenancePair(provenance)) {
    throw new Error("invalid provenance pair");
  }
  return { ...provenance };
}

export function inheritProvenance(
  parent: WindowProvenance,
  patch: Partial<WindowProvenance>,
): WindowProvenance {
  if (patch.packetId && patch.packetId !== parent.packetId) {
    throw new Error("cross-packet provenance inheritance is forbidden");
  }
  return makeWindowProvenance({
    ...parent,
    ...patch,
    packetId: parent.packetId,
  } as WindowProvenance);
}

function provenanceRank(provenance: WindowProvenance): number {
  return provenance.sourceMode === "fixture_only" ? 0 : 1;
}

export function selectMostConservativeProvenance(
  windows: readonly WindowProvenance[],
): WindowProvenance {
  if (windows.length === 0) {
    throw new Error("at least one visible window provenance is required");
  }

  let selected = windows[0];
  for (const window of windows.slice(1)) {
    if (provenanceRank(window) < provenanceRank(selected)) {
      selected = window;
    }
  }
  return selected;
}
