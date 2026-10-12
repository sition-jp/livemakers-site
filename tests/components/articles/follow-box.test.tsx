/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FollowBox } from "@/components/articles/FollowBox";
import ja from "@/messages/ja.json";

const COPY = {
  heading: ja.follow.heading,
  body: ja.follow.body,
  xButton: ja.follow.xButton.replace("{handle}", "LiveMakersCom"),
  googleButton: ja.follow.googleButton,
};

vi.mock("next/script", () => ({ default: () => null }));

type PreferredSourceQueue = { push: (...callbacks: unknown[]) => void };

function renderBox() {
  return render(<FollowBox copy={COPY} />);
}

afterEach(() => {
  delete (window as unknown as { PREFERRED_SOURCE?: unknown }).PREFERRED_SOURCE;
});

describe("FollowBox (記事末のフォロー枠)", () => {
  it("links to the X follow intent for @LiveMakersCom in a new tab", () => {
    renderBox();
    const link = screen.getByRole("link", { name: /@LiveMakersCom/ });
    expect(link).toHaveAttribute(
      "href",
      "https://x.com/intent/follow?screen_name=LiveMakersCom",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to the preferred-sources deeplink when Google's script is not ready", () => {
    renderBox();
    const link = screen.getByRole("link", { name: /優先ソース/ });
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/preferences/source?q=livemakers.com",
    );
    // スクリプト未読込でクリックしても既定動作 (直リンク) を止めない
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("hands the click to Google's preferred-source flow once the script is ready", () => {
    const addPreferredSource = vi.fn();
    const init = vi.fn();
    const queue: PreferredSourceQueue = {
      push: (...callbacks) =>
        callbacks.forEach((callback) =>
          (callback as (api: unknown) => void)({ init, addPreferredSource }),
        ),
    };
    (window as unknown as { PREFERRED_SOURCE: PreferredSourceQueue }).PREFERRED_SOURCE =
      queue;

    renderBox();
    const link = screen.getByRole("link", { name: /優先ソース/ });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(init).toHaveBeenCalledWith({ lang: "ja" });
    expect(addPreferredSource).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps modifier clicks as plain links (new-tab intent)", () => {
    const addPreferredSource = vi.fn();
    (window as unknown as { PREFERRED_SOURCE: PreferredSourceQueue }).PREFERRED_SOURCE = {
      push: (...callbacks) =>
        callbacks.forEach((callback) =>
          (callback as (api: unknown) => void)({ init: vi.fn(), addPreferredSource }),
        ),
    };
    renderBox();
    fireEvent.click(screen.getByRole("link", { name: /優先ソース/ }), {
      metaKey: true,
    });
    expect(addPreferredSource).not.toHaveBeenCalled();
  });
});
