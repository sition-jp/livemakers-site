/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IndicatorTileCard } from "@/components/home/IndicatorTileCard";
import { RadarObservationsCard } from "@/components/home/RadarObservationsCard";
import { RadarPromotedCard } from "@/components/home/RadarPromotedCard";
import { RADAR_OBSERVATIONS } from "@/lib/home/radar-observations";

const cells = [
  {
    instrumentId: "btc_usd" as const,
    nameJa: "BTC/USD",
    value: "$63,299",
    changeLabel: "+1.72%",
    up: true,
  },
  {
    instrumentId: "vix" as const,
    nameJa: "VIX",
    value: null,
    changeLabel: null,
    up: null,
  },
];
const provenance = {
  packetId: "mkt12_20260710_am",
  sourceMode: "fixture_only" as const,
  reviewStatus: "reviewed_fixture" as const,
  asOfJst: "07:58 JST",
};
const provenanceLabels = {
  review: "審査状態",
  source: "ソース",
  asOf: "as-of",
  packet: "パケットID",
};

describe("pair group (ledger groups 2-3)", () => {
  it("renders unavailable values and only shows an editorial regime when supplied", () => {
    const copy = {
      title: "12コア指標",
      dataDatePrefix: "データ日付",
      snapshotBadge: "SNAPSHOT",
      scrollHint: "← 横スクロールで全12指標",
      regimeLabel: "きょうの地合い",
      provenance: provenanceLabels,
    };
    const { rerender } = render(
      <IndicatorTileCard
        cells={cells}
        dataDate="2026-07-10"
        asOfLabel="07:58 JST"
        regimeNoteJa="リスクオン — BTC・ETH上昇・VIX低位安定"
        provenance={provenance}
        copy={copy}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/きょうの地合い/)).toBeInTheDocument();

    rerender(
      <IndicatorTileCard
        cells={cells}
        dataDate="2026-07-10"
        asOfLabel="07:58 JST"
        regimeNoteJa={undefined}
        provenance={provenance}
        copy={copy}
      />,
    );
    expect(screen.queryByText(/きょうの地合い/)).toBeNull();
  });

  it("keeps both radar cards title-only and explicitly marks their roots", () => {
    const laneLabels = {
      x_news_trends: "X浮上",
      sde_phase1_breaking_radar: "SDE検出",
      manual_operator_observation: "確認中",
    };
    const { container } = render(
      <>
        <RadarPromotedCard
          observation={RADAR_OBSERVATIONS[0]}
          publishedLabel="06:10"
          copy={{
            title: "速報レーダー — 記事になった観測",
            subtitle: "タイトルのみ · リンクなし",
            observedSuffix: "に観測 → 内容を確認のうえ、",
            publishedSuffix: "に Signal として公開。",
            laneLabels,
          }}
        />
        <RadarObservationsCard
          observations={RADAR_OBSERVATIONS.slice(1)}
          copy={{
            title: "ほかに観測中のタイトル",
            note: "内容の確認が取れたものだけが記事になります。",
            laneLabels,
          }}
        />
      </>,
    );
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll("[data-radar]")).toHaveLength(2);
    expect(screen.getByText("SDE検出")).toBeInTheDocument();
    expect(
      screen.getByText(/内容を確認のうえ、06:10 に Signal として公開/),
    ).toBeInTheDocument();
  });
});
