import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";

/** Representative output of livemakers_export.session_consolidator T5. */
const crystallizedEditorial = `市場は方向感を探っている。一次情報では判断材料が示された。

## 数値スナップショット

- USD/JPY 161.50 → 162.34（+0.5%）

| 指標 | 起点 | 現値 | 変化率 |
| --- | --- | --- | --- |
| USD/JPY | 161.50 | 162.34 | +0.5% |

## 一次情報ハイライト

- [一次情報で確認された主要な動き](https://primary.example.org/news/123) — 発表主体は次の対応方針を示した。
- [二つ目の確認事項](https://primary.example.org/news/456?view=%28all%29)

## 次の見どころ

- 次の公式発表を確認する。
`;

describe("crystallized session editorial MDX gate (P2-LVM-IT-G1 T5)", () => {
  it("compiles the complete lead, snapshot, linked highlights, and watch document", async () => {
    const compiled = await compile(crystallizedEditorial);
    expect(String(compiled.value)).toContain("一次情報ハイライト");
  });
});
