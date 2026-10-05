import { describe, expect, it, vi } from "vitest";

import { TransientLinkPreviewError, type FetchLike } from "@/lib/articles/link-preview";
import {
  isBlockedRelease,
  loadPressPhotos,
  parseMarkedRelease,
  pressCompanyName,
  selectPressPhotos,
} from "@/lib/articles/prtimes-photos";
import blocklist from "@/lib/articles/prtimes-photo-blocklist.json";

const RELEASE = "https://prtimes.jp/main/html/rd/p/000000017.000148444.html";
const MARKED = `${RELEASE}#sition-photos`;
const CDN = "https://prcdn.freetls.fastly.net/release_image/148444/17/";
const SUFFIX = "?format=jpeg&auto=webp&fit=bounds&width=1200&height=1200";
const PAGE = `<html><head>
<title>「積めない形」を「積める」に変える。積み木「KIKKA Basic40」が「グッド・トイ2026」を受賞 | 株式会社ウインテックのプレスリリース</title>
<meta property="og:image" content="https://prcdn.freetls.fastly.net/release_image/148444/17/148444-17-aaa111-1920x1080.jpg?format=jpeg&amp;auto=webp&amp;fit=bounds&amp;width=1200&amp;height=1200">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"株式会社ウインテック"}</script>
</head><body>
<img src="https://prcdn.freetls.fastly.net/release_image/148444/17/148444-17-aaa111-1920x1080.jpg?width=800">
<img src="https://prcdn.freetls.fastly.net/release_image/148444/17/148444-17-aaa111-640x360.jpg">
<img src="https://prcdn.freetls.fastly.net/release_image/148444/17/148444-17-logo222-1200x200.png">
<img src="https://prcdn.freetls.fastly.net/release_image/148444/17/148444-17-small333-300x300.jpg">
<img src="https://prcdn.freetls.fastly.net/release_image/148444/17/148444-17-bbb444-1200x900.jpg">
<img src="https://prcdn.freetls.fastly.net/release_image/99999/5/99999-5-other555-1920x1080.jpg">
<img src="https://prcdn.freetls.fastly.net/release_image/148444/17/148444-17-ccc666.jpg">
<img src="https://prcdn.freetls.fastly.net/release_image/148444/17/148444-17-ddd777-1080x1350.jpg">
</body></html>`;
const EXPECTED = [
  `${CDN}148444-17-aaa111-1920x1080.jpg${SUFFIX}`,
  `${CDN}148444-17-bbb444-1200x900.jpg${SUFFIX}`,
  `${CDN}148444-17-ccc666.jpg${SUFFIX}`,
];

function html(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

describe("parseMarkedRelease", () => {
  it("accepts only marked https prtimes release urls", () => {
    expect(parseMarkedRelease(MARKED)).toEqual({
      releaseUrl: RELEASE,
      releaseId: "000000017.000148444",
      releaseNo: "17",
      companyNo: "148444",
    });
    for (const bad of [
      RELEASE,
      `${RELEASE}#other`,
      `${RELEASE}?x=1#sition-photos`,
      "http://prtimes.jp/main/html/rd/p/000000017.000148444.html#sition-photos",
      "https://example.com/main/html/rd/p/000000017.000148444.html#sition-photos",
      "https://prtimes.jp/main/html/rd/p/abc.html#sition-photos",
    ]) {
      expect(parseMarkedRelease(bad), bad).toBeNull();
    }
  });
});

describe("selectPressPhotos", () => {
  it("applies every rule in order", () => {
    expect(selectPressPhotos(PAGE, parseMarkedRelease(MARKED)!)).toEqual(EXPECTED);
  });
});

describe("pressCompanyName", () => {
  it("reads the title, then JSON-LD, then falls back", () => {
    expect(pressCompanyName(PAGE)).toBe("株式会社ウインテック");
    expect(pressCompanyName(PAGE.replace("株式会社ウインテックのプレスリリース", "PR TIMES"))).toBe(
      "株式会社ウインテック",
    );
    expect(pressCompanyName("<html></html>")).toBe("発表企業");
    expect(Array.from(pressCompanyName(`<title>x | ${"あ".repeat(200)}のプレスリリース</title>`))).toHaveLength(80);
  });

  it("takes the last | segment of the title", () => {
    expect(pressCompanyName("<title>新商品 | ブランドA | 株式会社Xのプレスリリース</title>")).toBe("株式会社X");
  });
});

describe("loadPressPhotos", () => {
  it("fetches the unmarked release url and honours the blocklist", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => html(PAGE));
    await expect(loadPressPhotos(MARKED, fetchImpl, [])).resolves.toEqual({
      releaseUrl: RELEASE,
      company: "株式会社ウインテック",
      images: EXPECTED,
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(RELEASE);
    await expect(loadPressPhotos(MARKED, fetchImpl, ["000000017.000148444"])).resolves.toBeNull();
    await expect(loadPressPhotos(RELEASE, fetchImpl, [])).resolves.toBeNull();
    await expect(
      loadPressPhotos(MARKED, async () => new Response("x", { status: 404 }), []),
    ).resolves.toBeNull();
  });

  it("rejects with TransientLinkPreviewError on 503 and on network failure", async () => {
    await expect(
      loadPressPhotos(MARKED, async () => new Response("x", { status: 503 }), []),
    ).rejects.toBeInstanceOf(TransientLinkPreviewError);
    await expect(
      loadPressPhotos(
        MARKED,
        async () => {
          throw new TypeError("network");
        },
        [],
      ),
    ).rejects.toBeInstanceOf(TransientLinkPreviewError);
  });

  it("treats an oversized dims-like filename as having no dims", () => {
    const filename = `148444-17-x-${"9".repeat(5000)}x10.jpg`;
    const page = `<img src="${CDN}${filename}">`;
    expect(selectPressPhotos(page, parseMarkedRelease(MARKED)!)).toEqual([`${CDN}${filename}${SUFFIX}`]);
  });

  it("ships an array blocklist", () => {
    expect(Array.isArray(blocklist)).toBe(true);
  });
});

describe("isBlockedRelease", () => {
  it("blocks listed and unmarked urls only", () => {
    expect(isBlockedRelease(MARKED, ["000000017.000148444"])).toBe(true);
    expect(isBlockedRelease(MARKED, [])).toBe(false);
    expect(isBlockedRelease(RELEASE, [])).toBe(true);
  });
});
