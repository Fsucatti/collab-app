// app/docs/page.tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createDoc } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

type DocRow = {
  id: string;
  title: string;
  updatedAt: string;
  visibility: "PRIVATE" | "WORKSPACE" | "PUBLIC";
};

export default function DocsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 20);
  const q = searchParams.get("q")?.trim() || "";
  const visibility = searchParams.get("visibility") || "";

  const [rows, setRows] = React.useState<DocRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  // Fetch docs list when filters change
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(Math.min(100, Math.max(1, pageSize))),
      });
      if (q) qs.set("q", q);
      if (visibility) qs.set("visibility", visibility);

      const res = await fetch(`/api/docs?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!cancelled) {
        setRows(Array.isArray(json.rows) ? json.rows : []);
        setTotal(typeof json.total === "number" ? json.total : 0);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, pageSize, q, visibility]);

  async function handleNew() {
    try {
      const doc = await createDoc("Untitled");
      router.push(`/docs/${doc.id}`);
    } catch {
      alert("Failed to create document");
    }
  }

  return (
    <div className="container-outer py-6 max-w-5xl">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <h1 className="text-xl font-semibold">Documents</h1>
        <Button variant="primary" size="md" onClick={handleNew} className="inline-flex gap-2">
          <Plus size={16} />
          New
        </Button>
      </div>

      {/* List container */}
      <div className="card overflow-hidden">
        {loading && (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        )}

        {!loading && rows.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No documents.</div>
        )}

        {!loading && rows.length > 0 && (
          <div role="list">
            {/* Header row (optional). Hide on small screens */}
            <div className="hidden border-b bg-secondary/40 px-4 py-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[1fr_120px_220px_160px]">
              <div>Title</div>
              <div>Visibility</div>
              <div>Last updated</div>
              <div />
            </div>

            {rows.map((r) => (
              <button
                key={r.id}
                role="listitem"
                onClick={() => router.push(`/docs/${r.id}`)}
                className="w-full cursor-pointer border-b px-4 py-3 text-left transition hover:bg-muted/50 sm:grid sm:grid-cols-[1fr_120px_220px_160px] sm:items-center"
              >
                <div className="font-medium truncate">{r.title || "(Untitled)"}</div>

                <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground sm:mt-0 sm:text-[11px]">
                  {r.visibility}
                </div>

                <div className="mt-1 text-sm text-muted-foreground sm:mt-0">
                  <time dateTime={r.updatedAt}>
                    {new Date(r.updatedAt).toLocaleString()}
                  </time>
                </div>

                <div className="mt-2 flex justify-end sm:mt-0">
                  {/* Right-side actions placeholder (share/menu) */}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Footer summary (optional) */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
            <span>Total: {total}</span>
            {/* Hook up pagination later */}
          </div>
        )}
      </div>
    </div>
  );
}
