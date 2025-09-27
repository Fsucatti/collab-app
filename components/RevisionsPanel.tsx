"use client";

import { useEffect, useState } from "react";
import { getRevisions, type RevisionMeta } from "@/lib/api";

export default function RevisionsPanel({
  docId,
  open,
  onClose,
  onRestore,
}: {
  docId: string;
  open: boolean;
  onClose: () => void;
  onRestore: (revId: string) => void;
}) {
  const [revs, setRevs] = useState<RevisionMeta[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { items, nextCursor } = await getRevisions(docId);
        if (!mounted) return;
        setRevs(items);
        setCursor(nextCursor);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, docId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 backdrop-blur-sm">
      <div className="w-[560px] max-h-[70vh] overflow-hidden rounded-lg border border-border bg-card shadow-xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <strong className="text-sm">Revision history</strong>
          <button
            onClick={onClose}
            className="text-xs rounded-md border border-border px-2 py-1 hover:bg-brand-50 dark:hover:bg-brand-900/30"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[50vh] overflow-auto px-3 py-2">
          {revs.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between border-b border-dashed border-border/70 py-2 last:border-0"
            >
              <div className="text-xs text-muted">
                {new Date(r.createdAt).toLocaleString()}
              </div>
              <div className="flex gap-2">
                <button
                  className="text-xs rounded-md bg-brand-600 px-2 py-1 text-white hover:bg-brand-700"
                  onClick={() => onRestore(r.id)}
                >
                  Restore
                </button>
              </div>
            </div>
          ))}

          {!loading && revs.length === 0 && (
            <div className="p-2 text-xs text-muted">No revisions yet.</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border px-3 py-2">
          <button
            disabled={!cursor || loading}
            onClick={async () => {
              if (!cursor) return;
              setLoading(true);
              try {
                const { items, nextCursor } = await getRevisions(docId, cursor);
                setRevs((prev) => [...prev, ...items]);
                setCursor(nextCursor);
              } finally {
                setLoading(false);
              }
            }}
            className="text-xs rounded-md border border-border px-2 py-1 hover:bg-brand-50 disabled:opacity-60 disabled:hover:bg-transparent dark:hover:bg-brand-900/30"
          >
            {cursor ? "Load more" : "End"}
          </button>
        </div>
      </div>
    </div>
  );
}
