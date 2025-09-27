// components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "./ThemeToggle";
import AuthButtons from "./AuthButtons";

const links = [
  { href: "/docs", label: "Docs" },
  { href: "/trash", label: "Trash" },
  { href: "/p/guide", label: "Public Demo" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card-70 backdrop-blur supports-[backdrop-filter]:bg-card-60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        {/* Brand */}
        <button
          onClick={() => router.push("/docs")}
          className="mr-1 select-none text-base font-semibold tracking-tight hover:opacity-90"
          aria-label="Go to Docs"
        >
          collab<span className="text-muted">.app</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors",
                  active
                    ? "bg-[hsl(var(--color-brand-50))] text-fg"
                    : "text-muted hover:bg-[hsl(var(--color-brand-50))]",
                  "focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--color-card))]",
                ].join(" ")}
              >
                {l.label}
                {/* active/hover underline */}
                <span
                  className={[
                    "pointer-events-none absolute inset-x-2 -bottom-[2px] h-0.5 origin-left scale-x-0 rounded-full",
                    "bg-[hsl(var(--color-brand-600))] transition-transform duration-200",
                    active ? "scale-x-100" : "group-hover:scale-x-100",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>

        {/* Mobile burger */}
        <button
          className="ml-1 inline-flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--color-brand-50))] sm:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          ☰
        </button>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <AuthButtons />
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-nav" className="sm:hidden border-t border-border bg-card/95">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2">
            {links.map((l) => {
              const active = pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "rounded-md px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-[hsl(var(--color-brand-50))] text-fg"
                      : "text-muted hover:bg-[hsl(var(--color-brand-50))]",
                    "focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--color-card))]",
                  ].join(" ")}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
