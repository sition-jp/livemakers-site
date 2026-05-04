import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { readAssetsSnapshot } from "@/lib/pivots/pivots-reader";
import {
  AssetSymbolSchema,
  HorizonSchema,
  detailKey,
  type Horizon,
} from "@/lib/pivots/types";
import { AssetDetail } from "@/components/turning-points/AssetDetail";
import { DisclaimerBanner } from "@/components/turning-points/DisclaimerBanner";
import { UnavailableNotice } from "@/components/turning-points/UnavailableNotice";

/**
 * /turning-points/[asset]?h=<horizon> — Asset Detail (PRD §22 Screen 2).
 *
 * URL accepts lowercase asset (btc/eth) for friendliness; the zod schema
 * works on the uppercase symbol. Default horizon is 30D (PRD §28 dashboard
 * recommendation centers on 30D).
 */
export default async function TurningPointAssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; asset: string }>;
  searchParams: Promise<{ h?: string }>;
}) {
  const { locale, asset: rawAsset } = await params;
  setRequestLocale(locale);

  const upper = rawAsset.toUpperCase();
  const assetParse = AssetSymbolSchema.safeParse(upper);
  if (!assetParse.success) notFound();

  const { h } = await searchParams;
  const horizonRaw = h ?? "30D";
  const horizonParse = HorizonSchema.safeParse(horizonRaw);
  const selectedHorizon: Horizon = horizonParse.success
    ? horizonParse.data
    : "30D";

  const t = await getTranslations("turningPoints");
  const result = await readAssetsSnapshot();
  const detail = result.snapshot?.detail[detailKey(assetParse.data, selectedHorizon)];

  return (
    <section className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      <div>
        <Link
          href="/turning-points"
          className="text-xs uppercase tracking-label text-text-tertiary hover:text-text-primary"
        >
          {t("detail.back")}
        </Link>
      </div>
      <header>
        <h1 className="text-4xl font-light tracking-title text-text-primary">
          {assetParse.data}
        </h1>
        <p className="text-text-secondary mt-1">{t("page_subtitle")}</p>
      </header>

      <DisclaimerBanner />

      {result.parseError !== null ? (
        <UnavailableNotice
          reason={result.parseError}
          testid="detail-unavailable"
        />
      ) : detail ? (
        <AssetDetail
          detail={detail}
          asset={assetParse.data}
          selectedHorizon={selectedHorizon}
        />
      ) : (
        <div
          data-testid="detail-not-found"
          className="rounded-sm border border-border-primary px-6 py-12"
        >
          <h2 className="text-lg font-medium text-text-primary">
            {t("detail.not_found_title")}
          </h2>
          <p className="text-sm text-text-secondary mt-2">
            {t("detail.not_found_body")}
          </p>
        </div>
      )}
    </section>
  );
}
