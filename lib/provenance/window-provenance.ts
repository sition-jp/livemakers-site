export type ProvenanceState =
  | {
      sourceMode: "fixture_only";
      reviewStatus: "reviewed_fixture";
    }
  | {
      // 2026-08-14 田平氏裁定 (RWA live 配線): 毎時の自動収集値 (PF 検証なし)。
      // reviewed_live は「アンカー実施 + PF01-10 検証済」の意味なので流用しない
      sourceMode: "collected_live";
      reviewStatus: "auto_collected";
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
    (provenance.sourceMode === "collected_live" &&
      provenance.reviewStatus === "auto_collected") ||
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
  // 保守的な順 (低いほど保守的): fixture < 自動収集 < レビュー済み live
  if (provenance.sourceMode === "fixture_only") return 0;
  if (provenance.sourceMode === "collected_live") return 1;
  return 2;
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
