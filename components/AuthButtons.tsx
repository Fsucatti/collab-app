// components/AuthButtons.tsx
"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";

export default function AuthButtons() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn("github")}
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 active:scale-[.99] transition-[background,transform] duration-150"
      >
        Sign in
      </button>
    );
  }

  const name = session.user?.name ?? "You";
  const image = session.user?.image ?? "";

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 rounded-full border border-border px-2 py-1.5 bg-card text-fg">
        {image ? (
          <Image
            src={image}
            alt={name}
            width={24}
            height={24}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <div className="h-6 w-6 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        )}
        <span className="text-sm">{name.split(" ")[0]}</span>
      </button>

      <div className="absolute right-0 mt-2 hidden w-44 overflow-hidden rounded-lg border border-border bg-card text-sm shadow-lg group-hover:block animate-in fade-in slide-in-from-top-1">
        <a
          href="/settings"
          className="block px-3 py-2 hover:bg-brand-50 dark:hover:bg-brand-800/30 transition-colors"
        >
          Settings
        </a>
        <button
          onClick={() => signOut({ callbackUrl: "/signin" })}
          className="block w-full px-3 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-800/30 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
