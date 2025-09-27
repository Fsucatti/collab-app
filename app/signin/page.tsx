"use client";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold text-fg">Sign in</h1>
        <p className="mb-6 text-sm text-muted">Use your GitHub account to continue.</p>

        <button
          onClick={() => signIn("github", { callbackUrl: "/docs" })}
          className="
            inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border
            bg-card px-4 py-2.5 text-sm font-medium text-fg
            hover:bg-brand-50 active:scale-[0.99] transition
            dark:hover:bg-brand-900/30
          "
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.63 5.47 7.7.4.08.55-.18.55-.39 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.15-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.22 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.2-3.64-.91-3.64-4.03 0-.89.31-1.62.82-2.19-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.84a7.42 7.42 0 0 1 4.01 0c1.53-1.06 2.2-.84 2.2-.84.44 1.1.16 1.92.08 2.12.51.57.82 1.3.82 2.19 0 3.13-1.87 3.82-3.65 4.02.29.25.55.74.55 1.5 0 1.08-.01 1.95-.01 2.22 0 .21.15.47.55.39A8.14 8.14 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z"
            />
          </svg>
          Continue with GitHub
        </button>

        <p className="mt-4 text-center text-xs text-muted">
          You’ll be redirected to GitHub to authorize access.
        </p>
      </div>
    </div>
  );
}
