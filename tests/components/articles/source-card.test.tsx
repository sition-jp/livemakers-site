/* @vitest-environment jsdom */
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SourceCardView } from "@/components/articles/SourceCard";
import { SourceCardListItem } from "@/components/articles/SourceCardListItem";

const URL = "https://research.glassnode.com/the-week-onchain-week-38-2026/";
const IMAGE = "https://img.example.com/a.jpg";

describe("SourceCardView", () => {
  it("renders a small card with the writer's label, site name and a hotlinked image", () => {
    const { container } = render(
      <SourceCardView url={URL} label="glassnode Research" size="small" preview={{ image: IMAGE, siteName: "glassnode" }} />,
    );
    const anchor = container.querySelector("a[data-source-card='small']");
    expect(anchor?.getAttribute("href")).toBe(URL);
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(anchor?.className).toContain("not-prose");
    const img = container.querySelector("img");
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(anchor?.textContent).toContain("glassnode Research");
    expect(anchor?.textContent).toContain("glassnode");
  });

  it("renders nothing for a large card without an image", () => {
    const { container } = render(
      <SourceCardView url={URL} label="L" size="large" preview={{ image: null, siteName: "s" }} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("hides the whole large card when its image fails", () => {
    const { container } = render(
      <SourceCardView url={URL} label="L" size="large" preview={{ image: IMAGE, siteName: "s" }} />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect((container.querySelector("[data-source-card='large']") as HTMLElement).style.display).toBe("none");
  });
});

describe("SourceCardView — an image that already failed before hydration (onError never fires)", () => {
  const proto = HTMLImageElement.prototype;
  const original = {
    complete: Object.getOwnPropertyDescriptor(proto, "complete")!,
    naturalWidth: Object.getOwnPropertyDescriptor(proto, "naturalWidth")!,
  };
  function stubImageState(complete: boolean, naturalWidth: number) {
    Object.defineProperty(proto, "complete", { configurable: true, get: () => complete });
    Object.defineProperty(proto, "naturalWidth", { configurable: true, get: () => naturalWidth });
  }
  afterEach(() => {
    Object.defineProperty(proto, "complete", original.complete);
    Object.defineProperty(proto, "naturalWidth", original.naturalWidth);
  });

  it("hides the large card when its image already failed (complete, naturalWidth 0)", () => {
    stubImageState(true, 0);
    const large = render(
      <SourceCardView url={URL} label="L" size="large" preview={{ image: IMAGE, siteName: "s" }} />,
    ).container;
    expect((large.querySelector("[data-source-card='large']") as HTMLElement).style.display).toBe("none");
  });

  it("does not hide a small (lazy) card's image on mount — some browsers report unstarted lazy images as complete", () => {
    stubImageState(true, 0);
    const small = render(
      <SourceCardView url={URL} label="S" size="small" preview={{ image: IMAGE, siteName: "s" }} />,
    ).container;
    expect((small.querySelector("img") as HTMLElement).style.display).toBe("");
    expect((small.querySelector("[data-source-card='small']") as HTMLElement).style.display).toBe("");
  });

  it("loads the large card's image eagerly and small cards' images lazily", () => {
    const large = render(
      <SourceCardView url={URL} label="L" size="large" preview={{ image: IMAGE, siteName: "s" }} />,
    ).container;
    expect(large.querySelector("img")?.getAttribute("loading")).toBe("eager");
    const small = render(
      <SourceCardView url={URL} label="S" size="small" preview={{ image: IMAGE, siteName: "s" }} />,
    ).container;
    expect(small.querySelector("img")?.getAttribute("loading")).toBe("lazy");
  });

  it("keeps an image that loaded (or is still loading)", () => {
    stubImageState(true, 640);
    const loaded = render(
      <SourceCardView url={URL} label="L" size="large" preview={{ image: IMAGE, siteName: "s" }} />,
    ).container;
    expect((loaded.querySelector("[data-source-card='large']") as HTMLElement).style.display).toBe("");
    stubImageState(false, 0);
    const loading = render(
      <SourceCardView url={URL} label="L" size="large" preview={{ image: IMAGE, siteName: "s" }} />,
    ).container;
    expect((loading.querySelector("[data-source-card='large']") as HTMLElement).style.display).toBe("");
  });
});

vi.mock("@/components/articles/SourceCard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/articles/SourceCard")>()),
  SourceCard: ({ url, size }: { url: string; size: string }) => (
    <span data-source-card-stub={size} data-url={url} />
  ),
}));

describe("SourceCardListItem", () => {
  it("renders a small card for a marked item and a plain item otherwise", () => {
    const { container } = render(
      <ul>
        <SourceCardListItem data-source-url={URL} data-source-label="glassnode Research">
          <a href={URL}>glassnode Research</a>
        </SourceCardListItem>
        <SourceCardListItem>
          <a href="https://x.com/glassnode/status/1">公式 X</a>
        </SourceCardListItem>
      </ul>,
    );
    const items = container.querySelectorAll("li");
    expect(items[0].querySelector("[data-source-card-stub='small']")?.getAttribute("data-url")).toBe(URL);
    expect(items[1].querySelector("[data-source-card-stub]")).toBeNull();
    expect(items[1].querySelector("a")?.getAttribute("href")).toBe("https://x.com/glassnode/status/1");
  });
});
