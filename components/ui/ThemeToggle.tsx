"use client";

import { useEffect, useState } from "react";

export type ThemeName = "light" | "dark";

export const THEME_STORAGE_KEY = "lmk-theme";

function applyTheme(theme: ThemeName) {
  // Light is the default: it is expressed as the *absence* of the attribute
  // so a fresh visitor with no storage gets light without any JS running.
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeToggle() {
  // The server render assumes the light default. The real preference is
  // synced from the DOM after mount (set pre-paint by the inline init script
  // in the locale layout), so hydration never mismatches.
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    if (document.documentElement.getAttribute("data-theme") === "dark") {
      setTheme("dark");
    }
  }, []);

  function select(next: ThemeName) {
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode etc.) — the theme still applies
      // for the current page view.
    }
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex border border-border-primary p-0.5"
    >
      {(["light", "dark"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => select(option)}
          className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-label transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-pillar-overview ${
            theme === option
              ? "bg-text-primary text-bg-primary"
              : "text-text-tertiary hover:text-text-primary"
          }`}
        >
          {option === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}
