import { setRequestLocale } from "next-intl/server";
import { LogoSvg } from "@/components/ui/LogoSvg";
import { LogoVariantA } from "@/components/ui/LogoVariantA";
import { LogoVariantB } from "@/components/ui/LogoVariantB";
import { LogoVariantBDiamond } from "@/components/ui/LogoVariantBDiamond";
import { LogoVariantBOctagon } from "@/components/ui/LogoVariantBOctagon";
import { LogoVariantBPulse } from "@/components/ui/LogoVariantBPulse";
import { LogoVariantC } from "@/components/ui/LogoVariantC";
import { LogoVariantE } from "@/components/ui/LogoVariantE";
import { LogoVariantG } from "@/components/ui/LogoVariantG";
import { LogoVariantH } from "@/components/ui/LogoVariantH";
import { LogoVariantJ } from "@/components/ui/LogoVariantJ";

/**
 * Logo Lab — internal preview page for logo concept exploration.
 *
 * Not linked from public navigation. Visit at /logo-lab (or /ja/logo-lab).
 *
 * Sections:
 *   ① Header context — every variant rendered at the exact 28×28 chrome
 *      they will inhabit if chosen
 *   ② Neural Crystal family — original B + 3 directional variants
 *   ③ Other directions — A / C / E / G / H / J
 *   ④ Size scaling for the Neural Crystal family (the user's preferred
 *      direction) at 16 / 32 / 64 / 128 px
 *   ⑤ Color contexts (brand blue / mono / inverse) for the same family
 */

type Variant = {
  key: string;
  label: string;
  blurb: string;
  Comp: React.ComponentType<{ className?: string }>;
};

const placeholder: Variant = {
  key: "current",
  label: "CURRENT (placeholder)",
  blurb: "Diamond + E-stencil. SITION group placeholder mark.",
  Comp: LogoSvg,
};

const neuralFamily: Variant[] = [
  {
    key: "B",
    label: "B · NEURAL CRYSTAL (original)",
    blurb: "6 nodes → hexagonal crystal core. Distributed sources → SDE.",
    Comp: LogoVariantB,
  },
  {
    key: "B-diamond",
    label: "B-DIAMOND · rhombus center",
    blurb: "Same convergence, but central crystal is a SITION-family rhombus.",
    Comp: LogoVariantBDiamond,
  },
  {
    key: "B-octagon",
    label: "B-OCTAGON · 8 nodes, denser",
    blurb: "8 cardinal+intercardinal nodes feeding an octagonal crystal.",
    Comp: LogoVariantBOctagon,
  },
  {
    key: "B-pulse",
    label: "B-PULSE · halo around crystal",
    blurb: "Original B + a faint pulse halo, suggesting active processing.",
    Comp: LogoVariantBPulse,
  },
];

const otherDirections: Variant[] = [
  {
    key: "A",
    label: "A · PULSE LENS",
    blurb: "Live wave → optical lens → focused beam.",
    Comp: LogoVariantA,
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
  {
    key: "G",
    label: "G · SONAR PULSE (new)",
    blurb: "SITION diamond core broadcasts 3 concentric pulse rings outward.",
    Comp: LogoVariantG,
  },
  {
    key: "H",
    label: "H · APERTURE (new)",
    blurb: "Six-blade camera aperture closing on a central focal point.",
    Comp: LogoVariantH,
  },
  {
    key: "J",
    label: "J · STRATIFIED TOWER (new)",
    blurb: "Tier 1-4 horizontal layers + vertical SDE spine + base crystal.",
    Comp: LogoVariantJ,
  },
];

const allVariants: Variant[] = [
  placeholder,
  ...neuralFamily,
  ...otherDirections,
];

function HeaderRow({ variant }: { variant: Variant }) {
  const { Comp, label } = variant;
  return (
    <div className="flex items-center gap-6 border border-border-primary bg-bg-secondary px-6 py-4">
      <div className="flex w-72 items-center gap-3 text-text-primary">
        <Comp className="h-7 w-7 text-pillar-overview" />
        <span className="text-sm font-bold tracking-logo">LIVEMAKERS</span>
      </div>
      <div className="text-[10px] tracking-label text-text-tertiary">{label}</div>
    </div>
  );
}

function SizeRow({ variant }: { variant: Variant }) {
  const { Comp, label, blurb } = variant;
  return (
    <div className="border border-border-primary bg-bg-secondary p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="text-xs tracking-label text-pillar-overview">{label}</div>
        <div className="text-[10px] text-text-tertiary">{blurb}</div>
      </div>
      <div className="flex items-end gap-8 text-pillar-overview">
        <div className="flex flex-col items-center gap-2">
          <Comp className="h-4 w-4" />
          <span className="text-[9px] tracking-label text-text-tertiary">16</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Comp className="h-8 w-8" />
          <span className="text-[9px] tracking-label text-text-tertiary">32</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Comp className="h-16 w-16" />
          <span className="text-[9px] tracking-label text-text-tertiary">64</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Comp className="h-32 w-32" />
          <span className="text-[9px] tracking-label text-text-tertiary">128</span>
        </div>
      </div>
    </div>
  );
}

function ColorRow({ variant }: { variant: Variant }) {
  const { Comp, label } = variant;
  return (
    <div>
      <div className="mb-2 text-xs tracking-label text-pillar-overview">{label}</div>
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
  );
}

export default async function LogoLabPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10">
        <h1 className="mb-2 text-4xl font-light tracking-title">Logo Lab</h1>
        <p className="text-text-secondary">
          Internal preview of LiveMakers logo candidates. Not linked from
          public nav. Pick one and tell Claude.
        </p>
      </header>

      {/* ① Header context — every variant at real chrome size */}
      <section className="mb-16">
        <h2 className="mb-4 text-xs tracking-label text-text-tertiary">
          ① HEADER CONTEXT (28×28, real header chrome)
        </h2>
        <div className="space-y-3">
          {allVariants.map((v) => (
            <HeaderRow key={v.key} variant={v} />
          ))}
        </div>
      </section>

      {/* ② Neural Crystal family side-by-side */}
      <section className="mb-16">
        <h2 className="mb-4 text-xs tracking-label text-pillar-overview">
          ② NEURAL CRYSTAL FAMILY (your preferred direction)
        </h2>
        <p className="mb-6 text-xs text-text-tertiary">
          Original B and three directional variants. All keep the same
          convergence story (distributed sources → hardened crystal core),
          differing only in central geometry, density, and dynamism.
        </p>
        <div className="space-y-6">
          {neuralFamily.map((v) => (
            <SizeRow key={v.key} variant={v} />
          ))}
        </div>
      </section>

      {/* ③ Other directions */}
      <section className="mb-16">
        <h2 className="mb-4 text-xs tracking-label text-text-tertiary">
          ③ OTHER DIRECTIONS (for sanity comparison + new G/H/J drafts)
        </h2>
        <div className="space-y-6">
          {otherDirections.map((v) => (
            <SizeRow key={v.key} variant={v} />
          ))}
        </div>
      </section>

      {/* ④ Color contexts for Neural Crystal family */}
      <section className="mb-16">
        <h2 className="mb-4 text-xs tracking-label text-pillar-overview">
          ④ COLOR CONTEXTS — Neural Crystal family
        </h2>
        <p className="mb-6 text-xs text-text-tertiary">
          brand blue / mono white on dark / inverse on light
        </p>
        <div className="space-y-6">
          {neuralFamily.map((v) => (
            <ColorRow key={v.key} variant={v} />
          ))}
        </div>
      </section>

      {/* ⑤ Decision footer */}
      <section className="border-t border-border-primary pt-8">
        <p className="text-sm text-text-secondary">
          Tell Claude which variant wins (e.g. &ldquo;B-diamond&rdquo;) and
          the chosen one gets promoted to <code>LogoSvg.tsx</code>. The
          other LogoVariant* files and this <code>/logo-lab</code> page get
          archived in the same commit.
        </p>
      </section>
    </main>
  );
}
