export interface WindowProvenance {
  packetId: string;
  sourceMode: "fixture_only";
  reviewStatus: "reviewed_fixture";
  asOfJst: string;
}

export function makeWindowProvenance(
  provenance: WindowProvenance,
): WindowProvenance {
  return { ...provenance };
}

export function inheritProvenance(
  parent: WindowProvenance,
  patch: Partial<WindowProvenance>,
): WindowProvenance {
  if (patch.packetId && patch.packetId !== parent.packetId) {
    throw new Error("cross-packet provenance inheritance is forbidden");
  }
  return { ...parent, ...patch, packetId: parent.packetId };
}
