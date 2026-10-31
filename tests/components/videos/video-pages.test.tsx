/* @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ja from "@/messages/ja.json";
import { VideoArticle } from "@/components/videos/VideoArticle";
import { VideoList } from "@/components/videos/VideoList";
import { getVideoBySlug, type Video } from "@/lib/videos";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
// MDXRemote (rsc) は async server component なので jsdom では本文をそのまま出す
vi.mock("next-mdx-remote/rsc", () => ({
  MDXRemote: ({ source }: { source: string }) => <div data-testid="mdx">{source}</div>,
}));

const EP001 = getVideoBySlug("ep001-finance-reboot")!;
// 投稿前・投稿後の表示は、content の状態に左右されないよう fixture で固定する
const UNPOSTED: Video = { ...EP001, youtubeVideoId: undefined };
const POSTED: Video = { ...EP001, youtubeVideoId: "dQw4w9WgXcQ" };

function renderJa(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="ja" messages={ja}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("動画の記事 (投稿前)", () => {
  it("埋め込みの代わりに近日公開とチャンネルへのリンクを出す", () => {
    const { container } = renderJa(<VideoArticle video={UNPOSTED} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('[data-video-status="coming-soon"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: "YouTube チャンネル @LiveMakersCom" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@LiveMakersCom",
    );
  });

  it("チャプターは時刻を出すがリンクにしない", () => {
    const { container } = renderJa(<VideoArticle video={UNPOSTED} />);
    const chapters = container.querySelectorAll("[data-video-chapter]");
    expect(chapters).toHaveLength(8);
    expect(within(chapters[1] as HTMLElement).queryByRole("link")).toBeNull();
    expect(chapters[1].textContent).toContain("06:29");
  });

  it("出典を全件、通し番号で、新しいタブで開くリンクとして出す", () => {
    const { container } = renderJa(<VideoArticle video={EP001} />);
    const items = container.querySelectorAll("[data-video-source]");
    expect(items).toHaveLength(EP001.sources.length);
    expect(screen.getByRole("heading", { name: `出典 (全 ${EP001.sources.length} 件)` })).toBeInTheDocument();
    const lists = [...container.querySelectorAll("[data-video-sources] ol")];
    const starts = lists.map((list) => Number(list.getAttribute("start")));
    const sizes = lists.map((list) => list.querySelectorAll("li").length);
    starts.forEach((start, index) => {
      expect(start).toBe(1 + sizes.slice(0, index).reduce((sum, size) => sum + size, 0));
    });
    const first = within(items[0] as HTMLElement).getByRole("link");
    expect(first).toHaveAttribute("href", EP001.sources[0].url);
    expect(first).toHaveAttribute("target", "_blank");
    expect(first).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("動画の記事の関連記事", () => {
  it("台本の related と同じ並びでサイトの記事へリンクする", () => {
    const { container } = renderJa(<VideoArticle video={EP001} />);
    const links = within(container.querySelector("[data-video-related]") as HTMLElement).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/articles/future-map-20261031-2ac42693",
      "/articles/restart-map-20261026-3539f54e",
    ]);
  });
});

describe("動画の記事 (投稿後 — youtubeVideoId が入った状態)", () => {
  it("youtube-nocookie で埋め込み、チャプターが該当時刻へのリンクになる", () => {
    const { container } = renderJa(<VideoArticle video={POSTED} />);
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(container.querySelector('[data-video-status="coming-soon"]')).toBeNull();
    const chapter = container.querySelector('[data-video-chapter="06:29"]') as HTMLElement;
    expect(within(chapter).getByRole("link", { name: "06:29" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=389s",
    );
  });

  it("ep001 は @LiveMakersCom に上がった作り直し版の動画 (PlMDhxjz13k) を埋め込む", () => {
    expect(EP001.youtubeVideoId).toBe("PlMDhxjz13k");
    const { container } = renderJa(<VideoArticle video={EP001} />);
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/PlMDhxjz13k",
    );
  });
});

describe("動画の一覧", () => {
  it("回ごとのカードが記事へ飛び、投稿前の回に近日公開を付ける", () => {
    const { container } = renderJa(<VideoList videos={[POSTED, { ...UNPOSTED, slug: "ep000-x", href: "/videos/ep000-x" }]} />);
    const cards = container.querySelectorAll("[data-video-card]");
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector("[data-video-card-link]")).toHaveAttribute(
      "href",
      "/videos/ep001-finance-reboot",
    );
    // 関連記事はカードから辿れる (記事リンクの外に置き、a を入れ子にしない)
    const related = within(cards[0].querySelector("[data-video-related]") as HTMLElement);
    expect(related.getByRole("link", { name: /次の時代の地図 #25/ })).toHaveAttribute(
      "href",
      "/articles/future-map-20261031-2ac42693",
    );
    expect(cards[0].querySelector("a a")).toBeNull();
    expect(cards[0].textContent).not.toContain("近日公開");
    expect(cards[1].textContent).toContain("近日公開");
  });

  it("動画が無ければ空の案内を出す", () => {
    renderJa(<VideoList videos={[]} />);
    expect(screen.getByText(ja.videos.empty)).toBeInTheDocument();
  });
});
