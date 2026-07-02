import type {
  LocalizedText,
  TerminalPreviewPublicTopology,
} from "./types";

type TerminalLiveRadar = TerminalPreviewPublicTopology["liveRadar"];
type TerminalLiveRadarItem = TerminalLiveRadar["items"][number];

const forbiddenVisibleText = [
  "site_publish_log",
  "published_log",
  "publish_audit",
  "publish_candidates",
  "article_queue",
  "07_DATA",
  "operator",
  "draft",
  "review-packet",
  "file://",
  "/Users/",
  "http://",
  "https://",
  "raw X",
  "screenshot",
];

function hasBody(item: TerminalLiveRadarItem): boolean {
  return Object.prototype.hasOwnProperty.call(item, "body");
}

function validateVisibleText(
  value: string,
  label: string,
  errors: string[],
): void {
  for (const forbidden of forbiddenVisibleText) {
    if (value.includes(forbidden)) {
      errors.push(`${label} contains forbidden internal text: ${forbidden}`);
    }
  }
}

function validateLocalizedText(
  text: LocalizedText,
  label: string,
  errors: string[],
): void {
  validateVisibleText(text.en, `${label}.en`, errors);
  validateVisibleText(text.ja, `${label}.ja`, errors);
}

function validateItem(
  item: TerminalLiveRadarItem,
  index: number,
): string[] {
  const errors: string[] = [];

  if (item.href !== null) {
    errors.push(
      `liveRadar.items[${index}].href must remain null for title-window display`,
    );
  }

  if (hasBody(item)) {
    errors.push(
      `liveRadar.items[${index}].body must be absent for title-window display`,
    );
  }

  if (item.displayMode !== "title_only") {
    errors.push(
      `liveRadar.items[${index}].displayMode must be title_only`,
    );
  }

  if (item.publishDecision !== "not_authorized") {
    errors.push(
      `liveRadar.items[${index}].publishDecision must be not_authorized`,
    );
  }

  validateLocalizedText(item.title, `liveRadar.items[${index}].title`, errors);
  validateLocalizedText(
    item.sourceLabel,
    `liveRadar.items[${index}].sourceLabel`,
    errors,
  );
  validateLocalizedText(
    item.freshnessLabel,
    `liveRadar.items[${index}].freshnessLabel`,
    errors,
  );
  validateVisibleText(item.family, `liveRadar.items[${index}].family`, errors);

  return errors;
}

export function validateBreakingRadarTitleWindow(
  liveRadar: TerminalLiveRadar,
): string[] {
  const errors: string[] = [];
  const lanes = new Set(liveRadar.items.map((item) => item.sourceLane));

  if (!lanes.has("x_news_trends")) {
    errors.push("liveRadar.items must include x_news_trends lane");
  }

  if (!lanes.has("sde_phase1_breaking_radar")) {
    errors.push("liveRadar.items must include sde_phase1_breaking_radar lane");
  }

  validateLocalizedText(liveRadar.title, "liveRadar.title", errors);

  return errors.concat(
    liveRadar.items.flatMap((item, index) => validateItem(item, index)),
  );
}
