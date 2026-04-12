import { setRequestLocale } from "next-intl/server";
import { LogoSvg } from "@/components/ui/LogoSvg";
import { LogoVariantA } from "@/components/ui/LogoVariantA";
import { LogoVariantB } from "@/components/ui/LogoVariantB";
import { LogoVariantC } from "@/components/ui/LogoVariantC";
import { LogoVariantE } from "@/components/ui/LogoVariantE";

/**
 * Logo Lab — internal preview page for logo concept exploration.
 *
 * Not linked from the public navigation. Visit directly at /logo-lab
 * (or /ja/logo-lab). Renders all candidate variants side by side at
 * multiple sizes and color contexts so a final choice can be made by
 * looking at concrete pixels rather than written descriptions.
 *
 * The "Header context" row is the most important comparison — it shows
 * each variant at the exact size and chrome where it will actually live
 * once a winner is selected.
 */
export default async function LogoLabPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const variants = [
    {
      key: "current",
      label: "CURRENT (placeholder)",
      blurb: "Diamond + E-stencil. SITION group placeholder mark.",
      Comp: LogoSvg,
    },
    {
      key: "A",
      label: "A · PULSE LENS",
      blurb: "Live wave → optical lens → focused beam. Dynamic + insight.",
      Comp: LogoVariantA,
    },
    {
      key: "B",
      label: "B · NEURAL CRYSTAL",
      blurb: "Six distributed nodes → hexagonal crystal core. SDE Brain.",
      Comp: LogoVariantB,
    },
    {
      key: "C",
      label: "C · WAVE-TO-COMPASS",
      blurb: "Horizontal market wave + vertical conviction needle.",
      Comp: LogoVariantC,
    },
    {
      key: "E",
      label: "E · EYE OF NETWORK",
      blurb: "Almond eye + network iris + SITION diamond pupil.",
      Comp: LogoVariantE,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10">
        <h1 className="mb-2 text-4xl font-light tracking-title">Logo Lab</h1>
        <p className="text-text-secondary">
          Internal preview of LiveMakers logo candidates. Not linked from
          public nav. Pick one and tell Claude — the rest get archived.
        </p>
      </header>

      {/* Section 1: Header context — the most important comparison */}
      <section className="mb-16">
        <h2 className="mb-4 text-xs tracking-label text-text-tertiary">
          ① HEADER CONTEXT (28×28, real header chrome)
        </h2>
        <div className="space-y-3">
          {variants.map(({ key, label, Comp }) => (
            <div
              key={key}
              className="flex items-center gap-6 border border-border-primary bg-bg-secondary px-6 py-4"
            >
              <div className="flex w-72 items-center gap-3 text-text-primary">
                <Comp className="h-7 w-7 text-pillar-overview" />
                <span className="text-sm font-bold tracking-logo">
                  LIVEMAKERS
                </span>
              </div>
              <div className="text-[10px] tracking-label text-text-tertiary">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Size scaling — favicon to marketing */}
      <section className="mb-16">
        <h2 className="mb-4 text-xs tracking-label text-text-tertiary">
          ② SIZE SCALING (16 / 32 / 64 / 128 px)
        </h2>
        <div className="space-y-6">
          {variants.map(({ key, label, blurb, Comp }) => (
            <div
              key={key}
              className="border border-border-primary bg-bg-secondary p-6"
            >
              <div className="mb-4 flex items-baseline justify-between">
                <div className="text-xs tracking-label text-pillar-overview">
                  {label}
                </div>
                <div className="text-[10px] text-text-tertiary">{blurb}</div>
              </div>
              <div className="flex items-end gap-8 text-pillar-overview">
                <div className="flex flex-col items-center gap-2">
                  <Comp className="h-4 w-4" />
                  <span className="text-[9px] tracking-label text-text-tertiary">
                    16
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Comp className="h-8 w-8" />
                  <span className="text-[9px] tracking-label text-text-tertiary">
                    32
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Comp className="h-16 w-16" />
                  <span className="text-[9px] tracking-label text-text-tertiary">
                    64
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Comp className="h-32 w-32" />
                  <span className="text-[9px] tracking-label text-text-tertiary">
                    128
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Color contexts — primary, monochrome, inverse */}
      <section className="mb-16">
        <h2 className="mb-4 text-xs tracking-label text-text-tertiary">
          ③ COLOR CONTEXTS (brand blue / mono white / inverse on light)
        </h2>
        <div className="space-y-6">
          {variants.map(({ key, label, Comp }) => (
            <div key={key}>
              <div className="mb-2 text-xs tracking-label text-pillar-overview">
                {label}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex h-32 items-center justify-center border border-border-primary bg-bg-secondary text-pillar-overview">
                  <Comp className="h-16 w-16" />
                </div>
                <div className="flex h-32 items-center justify-center border border-border-primary bg-bg-secondary text-text-primary">
                  <Comp className="h-16 w-16" />
                </div>
                <div className="flex h-32 items-center justify-center border border-border-primary bg-text-primary text-bg-primary">
                  <Comp className="h-16 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Decision footer */}
      <section className="border-t border-border-primary pt-8">
        <p className="text-sm text-text-secondary">
          Tell Claude which variant wins (e.g. &ldquo;B&rdquo;) and the
          chosen one gets promoted to <code>LogoSvg.tsx</code>, the
          LogoVariant* files get archived, and this <code>/logo-lab</code>
          page gets removed in the same commit.
        </p>
      </section>
    </main>
  );
}
