import {
  SITE_LOGO_HEIGHT,
  SITE_LOGO_URL,
  SITE_LOGO_WIDTH,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

/** G3 (2026-09-11 田平氏 GO): トップページ用の `Organization` + `WebSite` JSON-LD。 */
export function buildHomeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/ja`,
        logo: {
          "@type": "ImageObject",
          url: SITE_LOGO_URL,
          width: SITE_LOGO_WIDTH,
          height: SITE_LOGO_HEIGHT,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/ja`,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "ja",
      },
    ],
  };
}
