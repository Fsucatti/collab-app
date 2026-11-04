// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import Providers from "./providers";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ProjectFooter from "@/components/ProjectFooter";

export const metadata: Metadata = {
  title: "Collab Notes",
  description: "A collaborative document editor with real-time editing, comments, and revision history.",
};

const setInitialTheme = `
(function () {
  try {
    var ls = localStorage.getItem('theme');
    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    var theme = ls || (mql.matches ? 'dark' : 'light');
    var root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  } catch {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="set-theme" strategy="beforeInteractive">
          {setInitialTheme}
        </Script>
      </head>
      <body className="bg-app text-fg flex min-h-screen flex-col">
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <ProjectFooter />
        </Providers>
      </body>
    </html>
  );
}
