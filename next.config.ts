import createNextIntlPlugin from "next-intl/plugin";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Build-time injected version metadata.
//
// Surfaced to the UI via NEXT_PUBLIC_* env vars so the values are baked into
// the client bundle at build time. Vercel sets `VERCEL_GIT_COMMIT_SHA` on
// every deployment; we fall back to `git rev-parse` for local builds.
//
// Uses process.cwd() rather than import.meta.url because Next.js compiles
// next.config.ts to CJS internally and ESM `import.meta` is not available
// in that context. process.cwd() resolves to the project root in all
// environments where Next is invoked.
const pkg = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf-8")
) as { version: string };

function gitShortSha(): string {
  // Vercel preferred — set automatically in their build environment.
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "dev";
  }
}

const ARTICLE_LANE_REDIRECTS = [
  // W35 (Weekly Brief #4) は content/brief ではなく site-first 記事レーンが
  // 正本。/brief 側で一度公開し X 告知まで出したあとに気づいたため、外部に
  // 流通した旧 URL を記事へ 308 で送る。旧 URL を残すと同じ号が 2 URL で
  // 並び、号数も /brief 系列の連番 (#2) と食い違う。
  {
    from: "/brief/2026-W35-brief",
    to: "/articles/weekly-brief-20260829-4741307c",
  },
] as const;

// 接頭辞なしで来たら `/ja/…` へ恒久で送る区分 (app/[locale] の下の、公開している区分)
const UNPREFIXED_PUBLIC_SECTIONS = [
  "about",
  "articles",
  "brief",
  "contact",
  "editorial-policy",
  "future-atlas",
  "privacy",
  "sessions",
  "topics",
  "turning-points",
  "videos",
] as const;

const nextConfig = {
  // サイト内検索 第2段階 (2026-10-02): 検索ページは repo 記事の本文
  // (content/articles/<slug>/ja.md) を実行時に読む。記事ページとは別の関数に
  // なるので、本文ファイルを確実に同梱する
  outputFileTracingIncludes: {
    "/[locale]/search": ["./content/articles/**/*.md", "./content/videos/**/*"],
    // sitemap は 1 時間ごとに実行時に作り直す。動画の一覧 (content/videos) を
    // 実行時にも読めるよう同梱する (動画のページ自体はビルド時に静的生成)
    "/sitemap.xml": ["./content/videos/**/*"],
    // トップ (ISR 300s) と記事詳細 (ISR 3600s) も右の動画の窓のために実行時に読む
    "/[locale]": ["./content/videos/**/*"],
    "/[locale]/articles/[slug]": ["./content/videos/**/*"],
    // 「最新の記事」の右レール (LatestArticlesRailLayout) は動画の記事も混ぜる
    // (2026-10-31)。ISR で作り直すページも content/videos を実行時に読む
    "/[locale]/about": ["./content/videos/**/*"],
    "/[locale]/future-atlas": ["./content/videos/**/*"],
    "/[locale]/sessions/archive": ["./content/videos/**/*"],
    "/[locale]/sessions/archive/past": ["./content/videos/**/*"],
    "/[locale]/topics/[topic]": ["./content/videos/**/*"],
    "/[locale]/topics/[topic]/page/[page]": ["./content/videos/**/*"],
    "/[locale]/articles/series/[series]": ["./content/videos/**/*"],
    "/[locale]/articles/series/[series]/page/[page]": ["./content/videos/**/*"],
    "/[locale]/videos": ["./content/videos/**/*"],
    "/[locale]/videos/[slug]": ["./content/videos/**/*"],
  },
  async redirects() {
    // 2026-11-09 到達の第 0 段: "/" → "/ja" を恒久 (308) にする。proxy (next-intl)
    // のままだと 307 (一時) になり、検索エンジンが "/" と "/ja" のどちらを
    // トップとして扱うか決めきれない。トップ = 日本語固定は 2026-08-21 田平氏 GO
    // (i18n/routing.ts) なので、恒久扱いにして問題ない。redirects は proxy より
    // 先に評価されるため、"/" だけがここで 1 ホップで送られる。
    const rootRedirect = { source: "/", destination: "/ja", permanent: true };
    // 2026-11-10 サイト流入 第 1 段: 接頭辞なしの URL (`/articles/<slug>` など) も
    // 恒久 (308) で `/ja/…` へ送る。proxy のままだと 307 (一時) で、Google が転送元の
    // `/articles/<slug>` を正規 URL に選んでいた (Search Console「重複。Google が別の
    // 正規ページを選択」112 件・URL 検査で確認)。対象は公開している区分だけ —
    // プレビュー・検索・登録などの内部の区分は proxy に任せる。個別の旧 URL
    // (ARTICLE_LANE_REDIRECTS) が先に当たるよう、最後に置く。
    // path の各区切りは「.」を含まないものだけ — redirects は public/ より先に
    // 評価されるので、「.」を許すと public/brief/<号>/thumbnail-*.png (Weekly Brief の
    // og:image) まで /ja/… へ送られて 404 になる。proxy の matcher (拡張子つきを
    // 除く) と同じ線引き。
    const unprefixedRedirect = {
      source: `/:section(${UNPREFIXED_PUBLIC_SECTIONS.join("|")})/:path([^/.]+)+`,
      destination: "/ja/:section/:path*",
      permanent: true,
    };
    // 区分のトップ (`/about` など) は専用の規則で送る。上の規則に path なしも任せると、
    // 本番 (Vercel) では行き先の末尾にスラッシュが付き (`/ja/about/`)、もう 1 回 308 で
    // `/ja/about` へ送られる 2 段の転送になっていた (2026-11-10 merge 後に本番で実測)。
    const unprefixedRootRedirect = {
      source: `/:section(${UNPREFIXED_PUBLIC_SECTIONS.join("|")})`,
      destination: "/ja/:section",
      permanent: true,
    };
    return [rootRedirect, ...ARTICLE_LANE_REDIRECTS.flatMap(({ from, to }) => [
      // locale 付き (X 告知が指しているのはこちら)
      {
        source: `/:locale(ja|en)${from}`,
        destination: `/:locale${to}`,
        permanent: true,
      },
      // locale なし — proxy の /ja 付与を待たず 1 ホップで送る
      { source: from, destination: `/ja${to}`, permanent: true },
    ]), unprefixedRootRedirect, unprefixedRedirect];
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_SHA: gitShortSha(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
    // Deployment-stable clock anchor for server-rendered freshness values
    // (lib/deployment-freshness.ts). Baked once per build so ISR
    // regenerations of unchanged data render byte-identical output — Vercel
    // then skips the billed write (ISR cost doctrine, 2026-08-01).
    NEXT_PUBLIC_BUILD_TIME_MS: String(Date.now()),
  },
};

export default withNextIntl(nextConfig);
