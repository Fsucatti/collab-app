"use client";

import React, { useEffect, useMemo, useState } from "react";

type TrashRow = {
  id: string;
  title: string;
  updatedAt: string | Date;
  deletedAt: string | Date | null;
  visibility?: string;
};

type TrashResponse = {
  rows: TrashRow[];
  total: number;
};

export default function TrashPage() {
  const [data, setData] = useState<TrashResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // TODO: wire up real pagination if you have it
  const page = 1;
  const pageSize = 20;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/trash?p=${page}&ps=${pageSize}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Partial<TrashResponse>;
        if (!cancelled) {
          setData({
            rows: Array.isArray(json.rows) ? (json.rows as TrashRow[]) : [],
            total: typeof json.total === "number" ? json.total : 0,
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load trash");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, pageSize]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const total = data?.total ?? 0;

  async function restore(id: string) {
    const res = await fetch(`/api/trash/${id}/restore`, { method: "POST" });
    if (res.ok) {
      setData(prev =>
        prev
          ? { ...prev, rows: prev.rows.filter(r => r.id !== id), total: Math.max(0, prev.total - 1) }
          : prev
      );
    }
  }

  async function destroy(id: string) {
    const res = await fetch(`/api/trash/${id}`, { method: "DELETE" });
    if (res.ok) {
      setData(prev =>
        prev
          ? { ...prev, rows: prev.rows.filter(r => r.id !== id), total: Math.max(0, prev.total - 1) }
          : prev
      );
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Trash</h1>

      {loading && <div className="text-sm text-zinc-500">Loading…</div>}
      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-sm text-zinc-500">Trash is empty.</div>
      )}

      {!loading && rows.length > 0 && (
        <>
          <div className="mb-2 text-xs text-zinc-500">
            {total} deleted {total === 1 ? "item" : "items"}
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_220px_200px] items-center gap-2 border-b border-zinc-200 px-3 py-3 last:border-b-0 dark:border-zinc-700"
              >
                <div>
                  <div className="font-semibold">{r.title || "(Untitled)"}</div>
                  <div className="text-xs text-zinc-500">ID: {r.id}</div>
                </div>

                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Deleted:{" "}
                  {r.deletedAt ? new Date(r.deletedAt).toLocaleString() : "—"}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => restore(r.id)}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => destroy(r.id)}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Delete forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
