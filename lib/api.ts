import type { CommentItem } from "@/lib/types";

export async function getDoc(id: string) {
  const res = await fetch(`/api/docs/${id}`);
  if (res.status === 404) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
export async function putDoc(id: string, title = id, content = "<p></p>") {
  return fetch(`/api/docs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
}
export async function patchDoc(id: string, content: string) {
  return fetch(`/api/docs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}
export async function getComments(id: string): Promise<CommentItem[]> {
  const res = await fetch(`/api/docs/${id}/comments`);
  return res.ok ? res.json() : [];
}
export async function postComment(id: string, payload: Partial<CommentItem> & { rangeFrom:number; rangeTo:number }) {
  const res = await fetch(`/api/docs/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("post comment failed");
  return res.json() as Promise<CommentItem>;
}
export async function deleteCommentApi(docId: string, commentId: string) {
  return fetch(`/api/docs/${docId}/comments/${commentId}`, { method: "DELETE" });
}

export async function patchComment(docId: string, commentId: string, payload: Partial<CommentItem>) {
  const res = await fetch(`/api/docs/${docId}/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("patch comment failed");
  return res.json() as Promise<CommentItem>;
}

export type RevisionMeta = { id: string; documentId: string; createdAt: string };

export async function getRevisions(docId: string, cursor?: string, limit = 20) {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  if (cursor) q.set("cursor", cursor);
  const res = await fetch(`/api/docs/${docId}/revisions?${q.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch revisions");
  return res.json() as Promise<{ items: RevisionMeta[]; nextCursor: string | null }>;
}

export async function restoreRevision(docId: string, revId: string) {
  const res = await fetch(`/api/docs/${docId}/revisions/${revId}/restore`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to restore revision");
  // Prefer returning { content } from the route; fall back to a full GET.
  try {
    const json = await res.json();
    if (json && typeof json.content === "string") {
      return json.content as string;
    }
  } catch {}
  const doc = await getDoc(docId);
  return res.json() as Promise<{ ok: true; content: string }>;
}

export async function listDocs(params?: { q?: string; page?: number; pageSize?: number; includeDeleted?: boolean }) {
  const u = new URL("/api/docs", location.origin);
  if (params?.q) u.searchParams.set("q", params.q);
  if (params?.page) u.searchParams.set("page", String(params.page));
  if (params?.pageSize) u.searchParams.set("pageSize", String(params.pageSize));
  if (params?.includeDeleted) u.searchParams.set("includeDeleted", "true");
  const r = await fetch(u);
  if (!r.ok) throw new Error("list docs failed");
  return r.json();
}

export async function createDoc(
  title?: string,
  content?: string,
  visibility: "private" | "workspace" | "public" = "private"
) {
  const res = await fetch(`/api/docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, visibility }),
  });
  if (!res.ok) throw new Error("POST /api/docs failed");
  // Note: server returns enum visibility in DB format (often UPPERCASE).
  return res.json() as Promise<{ id: string; title: string; updatedAt: string; visibility: string }>;
}

export async function deleteDoc(id: string) {
  const res = await fetch(`/api/docs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /api/docs/${id} failed`);
  return res.json();
}

export async function updateDocMeta(id: string, body: { title?: string; visibility?: "private"|"workspace"|"public" }) {
  const r = await fetch(`/api/docs/${id}/meta`, {
    method: "PATCH",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("update meta failed");
  return r.json();
}

export async function softDeleteDoc(id: string) {
  const r = await fetch(`/api/docs/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("delete failed");
  return r.json();
}

export async function listTrash(params?: { q?: string; page?: number; pageSize?: number }) {
  const u = new URL("/api/trash", location.origin);
  if (params?.q) u.searchParams.set("q", params.q);
  if (params?.page) u.searchParams.set("page", String(params.page));
  if (params?.pageSize) u.searchParams.set("pageSize", String(params.pageSize));
  const r = await fetch(u);
  if (!r.ok) throw new Error("list trash failed");
  return r.json();
}

export async function restoreDoc(id: string) {
  const r = await fetch(`/api/trash/${id}/restore`, { method: "POST" });
  if (!r.ok) throw new Error("restore failed");
  return r.json();
}

export async function patchDocMeta(
  id: string,
  data: { title?: string; visibility?: "private"|"team"|"public" }
) {
  const res = await fetch(`/api/docs/${id}/meta`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let msg = `PATCH /api/docs/${id}/meta failed`;
    try {
      const j = await res.json();
      if (j?.error || j?.detail) msg = `${msg}: ${j.error ?? ""} ${j.detail ?? ""}`.trim();
    } catch {
      // fallback to text if not JSON
      try { msg = `${msg}: ${await res.text()}`; } catch {}
    }
    throw new Error(msg);
  }
  return res.json() as Promise<{ id:string; title:string; visibility:"private"|"team"|"public"; updatedAt:string }>;
}
