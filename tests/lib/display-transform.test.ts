import { describe, expect, it } from "vitest";

import { calculateArticleBodyChecksum } from "@/lib/articles/article-inflow-contract";
import {
  ACTIVE_ARTICLE_DISPLAY_TRANSFORM_ID,
  DROP_LEADING_EXACT_TITLE_V1,
  applyArticleDisplayTransform,
} from "@/lib/articles/display-transform";

const TITLE = "📡 Signal｜法案が止まっても、規制は止まらない";
const BODY = `${TITLE}\n\nリード文。\n\n■ 章\n\n本文。`;

describe("applyArticleDisplayTransform (INFLOW-G2 D2)", () => {
  it("is active (T1b) and drops the duplicated title by default", () => {
    expect(ACTIVE_ARTICLE_DISPLAY_TRANSFORM_ID).toBe(DROP_LEADING_EXACT_TITLE_V1);
    const result = applyArticleDisplayTransform(BODY, TITLE);
    expect(result.displayBody).toBe("\nリード文。\n\n■ 章\n\n本文。");
    expect(result.displayTransformId).toBe(DROP_LEADING_EXACT_TITLE_V1);
  });

  it("fails open to none for bodies without a duplicated title (display == source)", () => {
    const body = "リード文のみ。\n\n本文。";
    const result = applyArticleDisplayTransform(body, TITLE);
    expect(result.displayBody).toBe(body);
    expect(result.displayTransformId).toBe("none");
    expect(result.displayBodyChecksum).toBe(calculateArticleBodyChecksum(body));
  });

  it("drops exactly the leading title line on trim-only exact match", () => {
    const result = applyArticleDisplayTransform(BODY, TITLE, DROP_LEADING_EXACT_TITLE_V1);
    expect(result.displayBody).toBe("\nリード文。\n\n■ 章\n\n本文。");
    expect(result.displayTransformId).toBe(DROP_LEADING_EXACT_TITLE_V1);
    expect(result.displayBodyChecksum).toBe(
      calculateArticleBodyChecksum(result.displayBody),
    );
  });

  it("tolerates surrounding whitespace but nothing else (trim-only)", () => {
    const padded = `  ${TITLE}  \n\n本文。`;
    const result = applyArticleDisplayTransform(padded, TITLE, DROP_LEADING_EXACT_TITLE_V1);
    expect(result.displayTransformId).toBe(DROP_LEADING_EXACT_TITLE_V1);
    expect(result.displayBody).toBe("\n本文。");
  });

  it.each([
    ["partial match", `${TITLE} 続き\n\n本文。`],
    ["different first line", `別の一行\n\n${TITLE}\n\n本文。`],
    ["empty body", ""],
    ["blank lines only", "\n\n"],
  ])("fails open (no change) on %s", (_label, body) => {
    const result = applyArticleDisplayTransform(body, TITLE, DROP_LEADING_EXACT_TITLE_V1);
    expect(result.displayBody).toBe(body);
    expect(result.displayTransformId).toBe("none");
  });

  it("skips leading blank lines when locating the first non-empty line", () => {
    const body = `\n\n${TITLE}\n\n本文。`;
    const result = applyArticleDisplayTransform(body, TITLE, DROP_LEADING_EXACT_TITLE_V1);
    expect(result.displayTransformId).toBe(DROP_LEADING_EXACT_TITLE_V1);
    expect(result.displayBody).toBe("\n\n\n本文。");
  });
});
