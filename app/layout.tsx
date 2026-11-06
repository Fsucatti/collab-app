// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import Providers from "./providers";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ProjectFooter from "@/components/ProjectFooter";

const description = "A collaborative document editor with real-time editing, comments, and revision history.";

export const metadata: Metadata = {
  metadataBase: new URL("https://collab-app-fsucatti.vercel.app"),
  title: "Collab Notes",
  description,
  // Preview shown when the link is shared in chats and social networks.
  openGraph: { type: "website", title: "Collab Notes", description, images: [{ url: "/og.jpg", width: 800, height: 420 }] },
  twitter: { card: "summary_large_image" },
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
