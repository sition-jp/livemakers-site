/* @vitest-environment jsdom */
import { render } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LogoMark } from "@/components/brand/LogoMark";

const master = fs.readFileSync(
  path.join(process.cwd(), "public/livemakers-logo-mark.svg"),
  "utf8",
);
const appIcon = fs.readFileSync(
  path.join(process.cwd(), "app/icon.svg"),
  "utf8",
);

describe("locked LiveMakers logo mark", () => {
  it("keeps the canonical path and three circle coordinates", () => {
    expect(master).toContain('d="M14 12H24V42H48V52H14Z"');
    expect(master).toContain('cx="45" cy="19" r="7"');
    expect(master).toContain('cx="34.5" cy="29" r="4"');
    expect(master).toContain('cx="28.5" cy="37.5" r="2.6"');
    expect(master.match(/currentColor/g)).toHaveLength(4);
  });

  it("renders the same four elements inline as decorative currentColor art", () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll("path")).toHaveLength(1);
    expect(svg.querySelectorAll("circle")).toHaveLength(3);
    expect(svg.querySelector("path")).toHaveAttribute(
      "d",
      "M14 12H24V42H48V52H14Z",
    );
  });

  it("uses the locked green ground and white mark for app icons", () => {
    expect(appIcon).toContain('fill="#0A4F44"');
    expect(appIcon.match(/fill="#FFFFFF"/g)).toHaveLength(4);
    expect(
      fs.statSync(path.join(process.cwd(), "app/apple-icon.png")).size,
    ).toBeGreaterThan(1_000);
  });
});
