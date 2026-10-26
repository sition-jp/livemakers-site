import { describe, expect, it } from "vitest";

import ja from "@/messages/ja.json";
import { pickClientMessages, pickMessages } from "@/lib/i18n/client-messages";

describe("pickMessages", () => {
  const messages = {
    nav: { overview: "トップ" },
    home: { provenance: { review: "審査状態" }, hero: { title: "x" } },
    articles: { title: "記事" },
  };

  it("keeps only the requested top-level and nested namespaces", () => {
    expect(pickMessages(messages, ["nav", "home.provenance"])).toEqual({
      nav: { overview: "トップ" },
      home: { provenance: { review: "審査状態" } },
    });
  });

  it("skips namespaces that do not exist", () => {
    expect(pickMessages(messages, ["nav", "missing", "home.nope"])).toEqual({
      nav: { overview: "トップ" },
    });
  });

  it("does not mutate the source messages", () => {
    const before = JSON.stringify(messages);
    pickMessages(messages, ["home", "home.provenance", "nav"]);
    expect(JSON.stringify(messages)).toBe(before);
  });
});

describe("pickClientMessages", () => {
  it("chrome scope is a small slice of the full dictionary", () => {
    const chrome = pickClientMessages(ja, "chrome");
    expect(Object.keys(chrome).sort()).toEqual(
      ["follow", "footer", "home", "nav", "search"],
    );
    expect(Object.keys(chrome.home as object)).toEqual(["provenance"]);
    // 全ページに焼き込まれる分 — 全辞書の 1 割未満に保つ
    expect(JSON.stringify(chrome).length).toBeLessThan(
      JSON.stringify(ja).length / 10,
    );
  });
});
