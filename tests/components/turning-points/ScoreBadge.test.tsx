/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBadge } from "@/components/turning-points/ScoreBadge";

describe("ScoreBadge", () => {
  it.each([
    [10, "Low"],
    [50, "Medium"],
    [78, "High"],
    [92, "Extreme"],
  ])("score %d renders level %s", (score, level) => {
    render(<ScoreBadge score={score} />);
    expect(screen.getByTestId("score-value")).toHaveTextContent(
      String(Math.round(score)),
    );
    expect(screen.getByTestId("score-level")).toHaveTextContent(level);
  });

  it("hides level when showLevel=false", () => {
    render(<ScoreBadge score={78} showLevel={false} />);
    expect(screen.queryByTestId("score-level")).toBeNull();
  });

  it("rounds non-integer scores", () => {
    render(<ScoreBadge score={73.7} />);
    expect(screen.getByTestId("score-value")).toHaveTextContent("74");
  });

  it("level boundary: 70 → High (not Medium)", () => {
    render(<ScoreBadge score={70} />);
    expect(screen.getByTestId("score-level")).toHaveTextContent("High");
  });

  it("level boundary: 85 → Extreme (not High)", () => {
    render(<ScoreBadge score={85} />);
    expect(screen.getByTestId("score-level")).toHaveTextContent("Extreme");
  });
});
