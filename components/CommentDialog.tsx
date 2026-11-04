// components/CommentDialog.tsx
"use client";

import { useState } from "react";

type Props = {
  anchorText: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
};

/** In-page form: window.prompt() is not available in every browser or embedded view. */
export default function CommentDialog({ anchorText, onSubmit, onCancel }: Props) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const trimmed = content.trim();

  async function submit() {
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="New comment"
        className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl"
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); }
        }}
      >
        <h2 className="mb-2 text-sm font-semibold text-fg">New comment</h2>
        <blockquote className="mb-3 max-h-20 overflow-auto border-l-2 border-border pl-2 text-xs text-muted">
          {anchorText}
        </blockquote>
        <textarea
          autoFocus
          value={content}
          maxLength={4000}
          rows={4}
          placeholder="Write a comment…"
          aria-label="Comment"
          onChange={(e) => setContent(e.target.value)}
          className="w-full resize-y rounded-md border border-border bg-transparent p-2 text-sm text-fg outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-md border border-border px-3 text-xs hover:bg-brand-50 dark:hover:bg-brand-800/30"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed || sending}
            className="h-8 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {sending ? "Adding…" : "Add comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
