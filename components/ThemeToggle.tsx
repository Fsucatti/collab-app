"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = (theme ?? resolvedTheme) === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="
        inline-flex items-center gap-2 rounded-lg border border-border
        bg-card/70 px-2.5 py-1.5 text-sm text-fg shadow-sm
        hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-ring
        dark:hover:bg-brand-900/30
      "
    >
      <span className="sr-only">Toggle theme</span>
      <span className="leading-none">{isDark ? "🌙" : "☀️"}</span>
      <span className="hidden sm:inline">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
