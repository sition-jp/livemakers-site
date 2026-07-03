/* @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LogoColorBand } from "@/components/layout/LogoColorBand";

describe("LogoColorBand", () => {
  it("renders a decorative band driven by the logo color token", () => {
    render(<LogoColorBand />);
    const band = screen.getByTestId("logo-color-band");
    expect(band).toHaveAttribute("aria-hidden", "true");
    expect(band.className).toContain("bg-logo");
  });
});
