// components/CommentsSidebar.tsx
"use client";
import type { CommentItem } from "@/lib/types";

type Props = {
  comments: CommentItem[];
  highlightedIds: Set<string>;
  toggleHighlight: (id: string) => void;
  deleteComment?: (id: string) => void;
  onAddComment?: () => void;

  resolveComment?: (id: string, resolved: boolean) => void;
  showResolved?: boolean;
  onToggleShowResolved?: () => void;

  collapsed?: boolean;
  onToggleCollapse?: () => void;

  minified?: boolean;
  onToggleMinified?: () => void;
};

export default function CommentsSidebar({
  comments,
  highlightedIds,
  toggleHighlight,
  deleteComment,
  onAddComment,
  resolveComment,
  showResolved = false,
  onToggleShowResolved,
  collapsed = false,
  onToggleCollapse,
  minified = false,
  onToggleMinified,
}: Props) {
  const filtered =
    typeof onToggleShowResolved === "function"
      ? comments.filter((c) => (showResolved ? true : !c.resolved))
      : comments;

  // Compact rail
  if (minified) {
    return (
      <aside className="border-t border-border md:border-l md:border-t-0">
        <div className="flex items-center justify-center py-2 md:sticky md:top-4 md:h-[calc(100vh-32px)] md:w-9">
          <button
            aria-label="Open comments"
            onClick={onToggleMinified}
            className="writing-vertical-rl rotate-180 text-xs rounded-lg border border-border bg-card px-1.5 py-1
                       hover:bg-brand-50 dark:hover:bg-brand-800/30 transition-colors"
            title="Open comments"
          >
            💬 {comments.length}
          </button>
        </div>
      </aside>
    );
  }

  // Expanded
  return (
    <aside className="border-t border-border pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
      <div className="flex flex-col gap-2 md:sticky md:top-4 md:max-h-[calc(100vh-32px)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-fg">Comments</div>
          <div className="flex flex-wrap items-center gap-2">
            {onAddComment && (
              <button
                onClick={onAddComment}
                className="h-7 rounded-md bg-brand-600 px-2 text-xs font-medium text-white
                           hover:bg-brand-700 active:scale-[0.99] transition"
              >
                Add comment
              </button>
            )}
            {typeof onToggleShowResolved === "function" && (
              <label className="inline-flex select-none items-center gap-1 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={!!showResolved}
                  onChange={onToggleShowResolved}
                  className="accent-brand-600"
                />
                Show resolved
              </label>
            )}
            {typeof onToggleCollapse === "function" && (
              <button
                onClick={onToggleCollapse}
                className="h-7 rounded-md border border-border px-2 text-xs
                           hover:bg-brand-50 dark:hover:bg-brand-800/30 transition-colors"
              >
                {collapsed ? "Expand" : "Collapse"}
              </button>
            )}
            {typeof onToggleMinified === "function" && (
              <button
                onClick={onToggleMinified}
                title="Collapse sidebar"
                className="h-7 rounded-md border border-border px-2 text-xs
                           hover:bg-brand-50 dark:hover:bg-brand-800/30 transition-colors"
              >
                Minify
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {!collapsed && (
          <div className="overflow-auto pr-1.5">
            {filtered.map((c) => (
              <div
                key={c.id}
                className={[
                  "mb-2 rounded-lg border border-border p-2.5",
                  "transition-[transform,box-shadow] duration-150 hover:-translate-y-[1px] hover:shadow-sm",
                  c.resolved ? "opacity-60" : "",
                ].join(" ")}
                aria-live="polite"
              >
                <div className="text-xs text-muted">
                  {new Date(c.createdAt).toLocaleString()}
                  {c.resolved ? " · resolved" : ""}
                </div>
                <div className="font-semibold text-fg">{c.author}</div>
                <div className="whitespace-pre-wrap text-fg">{c.content}</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleHighlight(c.id)}
                    className="h-7 rounded-md border border-border px-2 text-xs
                               hover:bg-brand-50 dark:hover:bg-brand-800/30 transition-colors"
                  >
                    {highlightedIds.has(c.id) ? "Unhighlight" : "Highlight"}
                  </button>

                  <button
                    onClick={() =>
                      (window as any).__activeTiptapEditor?.revealRange?.(c.rangeFrom, c.rangeTo)
                    }
                    className="h-7 rounded-md border border-border px-2 text-xs
                               hover:bg-brand-50 dark:hover:bg-brand-800/30 transition-colors"
                  >
                    Jump
                  </button>

                  {typeof resolveComment === "function" && (
                    <button
                      onClick={() => resolveComment(c.id, !c.resolved)}
                      className="h-7 rounded-md bg-accent-500 px-2 text-xs font-medium text-black
                                 hover:bg-accent-600 active:scale-[0.99] transition"
                    >
                      {c.resolved ? "Unresolve" : "Resolve"}
                    </button>
                  )}

                  {typeof deleteComment === "function" && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="h-7 rounded-md border border-border px-2 text-xs
                                 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-2 text-xs text-muted">No comments.</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
