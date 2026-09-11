import { buildHomeJsonLd } from "@/lib/seo/organization-json-ld";

/** G3: トップページの `Organization` + `WebSite` 構造化データ。 */
export function OrganizationJsonLd() {
  const json = buildHomeJsonLd();
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
