"use client";

import { useState } from "react";

export function LanguageToggle({
  defaultLang,
  onChange,
}: {
  defaultLang: "en" | "ja";
  onChange: (lang: "en" | "ja") => void;
}) {
  const [active, setActive] = useState<"en" | "ja">(defaultLang);

  function select(lang: "en" | "ja") {
    setActive(lang);
    onChange(lang);
  }

  return (
    <div className="inline-flex items-center gap-1 border border-border-primary p-1 text-[10px] tracking-label">
      <button
        type="button"
        onClick={() => select("en")}
        className={
          "px-3 py-1 " +
          (active === "en" ? "bg-pillar-overview text-bg-primary" : "text-text-secondary")
        }
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => select("ja")}
        className={
          "px-3 py-1 " +
          (active === "ja" ? "bg-pillar-overview text-bg-primary" : "text-text-secondary")
        }
      >
        日本語
      </button>
    </div>
  );
}
