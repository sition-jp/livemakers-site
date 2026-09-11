import { describe, expect, it } from "vitest";

import { buildHomeJsonLd } from "@/lib/seo/organization-json-ld";

describe("lib/seo/organization-json-ld", () => {
  it("declares Organization + WebSite under one @graph", () => {
    const json = buildHomeJsonLd();
    const types = json["@graph"].map((entry) => entry["@type"]);
    expect(types).toEqual(["Organization", "WebSite"]);
  });

  it("links WebSite.publisher back to the Organization @id", () => {
    const json = buildHomeJsonLd();
    const org = json["@graph"].find((entry) => entry["@type"] === "Organization")!;
    const site = json["@graph"].find((entry) => entry["@type"] === "WebSite")! as {
      publisher: { "@id": string };
    };
    expect(site.publisher["@id"]).toBe(org["@id"]);
  });

  it("uses the real apple-icon.png logo, not the SVG", () => {
    const json = buildHomeJsonLd();
    const org = json["@graph"].find((entry) => entry["@type"] === "Organization")! as {
      logo: { url: string };
    };
    expect(org.logo.url).toBe("https://livemakers.com/apple-icon.png");
  });
});
