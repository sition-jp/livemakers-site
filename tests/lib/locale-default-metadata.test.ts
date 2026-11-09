import { describe, expect, it } from "vitest";

import {
  JA_HOME_DESCRIPTION,
  JA_HOME_TITLE,
  localeDefaultMetadata,
} from "@/lib/seo/locale-default-metadata";

describe("lib/seo/locale-default-metadata", () => {
  it("gives Japanese pages a Japanese title, description and ja_JP open graph", () => {
    const meta = localeDefaultMetadata("ja");
    expect(meta.title).toEqual({ absolute: JA_HOME_TITLE, template: "%s | LiveMakers" });
    expect(meta.description).toBe(JA_HOME_DESCRIPTION);
    expect(JA_HOME_TITLE).toMatch(/金融再起動/);
    const og = meta.openGraph as { locale?: string; title?: string };
    expect(og.locale).toBe("ja_JP");
    expect(og.title).toBe(JA_HOME_TITLE);
    const twitter = meta.twitter as { site?: string };
    expect(twitter.site).toBe("@LiveMakersCom");
  });

  it("leaves English pages on the root (English) defaults", () => {
    expect(localeDefaultMetadata("en")).toEqual({});
  });
});
