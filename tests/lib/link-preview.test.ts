import { describe, expect, it, vi } from "vitest";

import {
  fetchLinkPreview,
  isFetchableUrl,
  parseLinkPreview,
  type FetchLike,
} from "@/lib/articles/link-preview";

const PAGE = "https://www.bepal.net/archives/726905";

function htmlResponse(body: BodyInit, init: { status?: number; type?: string } = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": init.type ?? "text/html; charset=utf-8" },
  });
}

describe("isFetchableUrl", () => {
  it("accepts public https urls only", () => {
    expect(isFetchableUrl(PAGE)).toBe(true);
    for (const url of [
      "http://example.com/",
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://localhost/",
      "https://app.localhost/",
      "https://nas.local/",
      "https://svc.internal/",
      "ftp://example.com/",
      "not a url",
    ]) {
      expect(isFetchableUrl(url), url).toBe(false);
    }
  });
});

describe("parseLinkPreview", () => {
  it("reads og:image and og:site_name regardless of attribute order", () => {
    const html =
      '<meta property="og:image" content="https://img.example.com/a.jpg">' +
      '<meta content="BE-PAL" property="og:site_name">';
    expect(parseLinkPreview(html, PAGE)).toEqual({
      image: "https://img.example.com/a.jpg",
      siteName: "BE-PAL",
    });
  });

  it("falls back to twitter:image, resolves relative paths and decodes &amp;", () => {
    const html = '<meta name="twitter:image" content="/img/a.jpg?w=1&amp;h=2">';
    expect(parseLinkPreview(html, PAGE)).toEqual({
      image: "https://www.bepal.net/img/a.jpg?w=1&h=2",
      siteName: "bepal.net",
    });
  });

  it("prefers og:image and drops http images", () => {
    const both =
      '<meta name="twitter:image" content="https://t.example.com/t.jpg">' +
      '<meta property="og:image" content="https://o.example.com/o.jpg">';
    expect(parseLinkPreview(both, PAGE).image).toBe("https://o.example.com/o.jpg");
    expect(
      parseLinkPreview('<meta property="og:image" content="http://i.example.com/a.jpg">', PAGE).image,
    ).toBeNull();
  });
});

describe("fetchLinkPreview", () => {
  it("returns the parsed preview and passes the timeout and 1-day cache options", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      htmlResponse('<meta property="og:image" content="https://img.example.com/a.jpg">'),
    );
    await expect(fetchLinkPreview(PAGE, fetchImpl)).resolves.toEqual({
      image: "https://img.example.com/a.jpg",
      siteName: "bepal.net",
    });
    const init = fetchImpl.mock.calls[0][1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.next).toEqual({ revalidate: 86400 });
  });

  it("never fetches urls that are not fetchable", async () => {
    const fetchImpl = vi.fn<FetchLike>();
    await expect(fetchLinkPreview("http://example.com/x", fetchImpl)).resolves.toEqual({
      image: null,
      siteName: "example.com",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back on errors, non-2xx and non-HTML responses", async () => {
    const og = '<meta property="og:image" content="https://i.example.com/a.jpg">';
    const cases: FetchLike[] = [
      async () => {
        throw new DOMException("timeout", "TimeoutError");
      },
      async () => htmlResponse(og, { status: 404 }),
      async () => htmlResponse(og, { type: "application/json" }),
    ];
    for (const fetchImpl of cases) {
      await expect(fetchLinkPreview(PAGE, fetchImpl)).resolves.toEqual({
        image: null,
        siteName: "bepal.net",
      });
    }
  });

  it("reads at most 512KB of the page", async () => {
    const late = `${"x".repeat(600 * 1024)}<meta property="og:image" content="https://i.example.com/late.jpg">`;
    const result = await fetchLinkPreview(PAGE, async () => htmlResponse(late));
    expect(result.image).toBeNull();
  });

  it("decodes pages with the charset declared in Content-Type (Shift_JIS)", async () => {
    // 「ビーパル」の Shift_JIS バイト列
    const head = new TextEncoder().encode('<meta property="og:site_name" content="');
    const name = new Uint8Array([0x83, 0x72, 0x81, 0x5b, 0x83, 0x70, 0x83, 0x8b]);
    const tail = new TextEncoder().encode('">');
    const body = new Uint8Array([...head, ...name, ...tail]);
    const result = await fetchLinkPreview(PAGE, async () =>
      htmlResponse(body, { type: "text/html; charset=Shift_JIS" }),
    );
    expect(result.siteName).toBe("ビーパル");
  });
});
