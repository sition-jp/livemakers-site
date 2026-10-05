/* @vitest-environment jsdom */
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PressPhotosView } from "@/components/articles/PressPhotos";

const RELEASE = "https://prtimes.jp/main/html/rd/p/000000017.000148444.html";
const IMGS = [
  "https://prcdn.freetls.fastly.net/release_image/148444/17/a.jpg?x=1",
  "https://prcdn.freetls.fastly.net/release_image/148444/17/b.jpg?x=1",
];

describe("PressPhotosView", () => {
  it("renders up to 3 uncropped photos with the credit and release link", () => {
    const { container } = render(
      <PressPhotosView photos={{ releaseUrl: RELEASE, company: "株式会社ウインテック", images: IMGS }} eagerFirst />,
    );
    const figure = container.querySelector("figure[data-press-photos='2']");
    expect(figure).not.toBeNull();
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute("src")).toBe(IMGS[0]);
    expect(imgs[0].getAttribute("alt")).toBe("株式会社ウインテックのプレスリリース画像 1");
    expect(imgs[0].getAttribute("loading")).toBe("eager");
    expect(imgs[1].getAttribute("loading")).toBe("lazy");
    expect(imgs[0].getAttribute("referrerpolicy")).toBe("no-referrer");
    const caption = container.querySelector("figcaption");
    expect(caption?.textContent).toBe("画像：株式会社ウインテック（PR TIMES）プレスリリース");
    const link = caption?.querySelector("a");
    expect(link?.getAttribute("href")).toBe(RELEASE);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("lazy-loads every photo when not first", () => {
    const { container } = render(
      <PressPhotosView photos={{ releaseUrl: RELEASE, company: "c", images: IMGS }} eagerFirst={false} />,
    );
    for (const img of container.querySelectorAll("img")) expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("renders nothing without photos and hides a photo that fails to load", () => {
    expect(
      render(<PressPhotosView photos={{ releaseUrl: RELEASE, company: "c", images: [] }} eagerFirst />).container
        .innerHTML,
    ).toBe("");
    const { container } = render(
      <PressPhotosView photos={{ releaseUrl: RELEASE, company: "c", images: IMGS }} eagerFirst />,
    );
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(img.style.display).toBe("none");
  });

  it("hides an eager image that has already failed before hydration", () => {
    // Mock an already-failed image: complete=true, naturalWidth=0
    const completeDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    const naturalWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth");

    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get() {
        return true;
      },
    });

    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        return 0;
      },
    });

    try {
      const { container } = render(
        <PressPhotosView photos={{ releaseUrl: RELEASE, company: "c", images: [IMGS[0]] }} eagerFirst />,
      );
      const img = container.querySelector("img")!;
      expect(img.style.display).toBe("none");
    } finally {
      // Restore original descriptors
      if (completeDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "complete", completeDescriptor);
      }
      if (naturalWidthDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", naturalWidthDescriptor);
      }
    }
  });

  it("does NOT hide a lazy image that has complete=true but naturalWidth=0 at mount", () => {
    // Mock an already-failed image state
    const completeDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    const naturalWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth");

    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get() {
        return true;
      },
    });

    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get() {
        return 0;
      },
    });

    try {
      const { container } = render(
        <PressPhotosView photos={{ releaseUrl: RELEASE, company: "c", images: [IMGS[0]] }} eagerFirst={false} />,
      );
      const img = container.querySelector("img")!;
      // Lazy image should NOT be hidden on mount, even though the mocked state looks failed
      expect(img.style.display).not.toBe("none");
    } finally {
      // Restore original descriptors
      if (completeDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "complete", completeDescriptor);
      }
      if (naturalWidthDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", naturalWidthDescriptor);
      }
    }
  });
});
