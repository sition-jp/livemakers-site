export interface TickerSnapshot {
  ada_price_usd: number;
  ada_change_24h: number;
  ada_mcap_usd: number;
  cardano_tvl_usd: number;
  tvl_change_24h: number;
  stake_active_percent: number;
  naka_rank: number;
}

export interface FourPanelSummary {
  governance: string;
  defi: string;
  midnight: string;
  risk: string;
}

export interface BriefMetadata {
  slug: string;
  issue_number: number;
  week_label: string;
  publish_date: string;
  published_at: string;
  epoch: number;
  sipo_rank: number;
  tags: string[];
  reading_time_min: number;
  title_en: string;
  title_ja: string;
  executive_summary_en: string;
  executive_summary_ja: string;
  ticker_snapshot: TickerSnapshot;
  four_panel_summary: FourPanelSummary;
  /**
   * Whether a downloadable PDF exists at `public/brief/{slug}/brief.pdf`.
   * Defaults to false so the PDF download button is hidden unless explicitly
   * set true by the publisher.
   */
  has_pdf?: boolean;
}

export interface Brief {
  slug: string;
  metadata: BriefMetadata;
  bodyEn: string;
  bodyJa: string;
  pdfPath: string;
}

export interface TickerResponse {
  ada: { price_usd: number; change_24h: number; mcap_usd: number };
  tvl: { cardano_usd: number; change_24h: number };
  stake: { active_percent: number };
  epoch: number;
  naka: number;
  updated_at: string;
  stale?: boolean;
}
