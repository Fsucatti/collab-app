// app/docs/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import PresenceBar from "@/components/PresenceBar";
import CommentsSidebar from "@/components/CommentsSidebar";
import RevisionsPanel from "@/components/RevisionsPanel";
import ToastContainer, { toast } from "@/components/Toast";
import VisibilityPicker from "@/components/VisibilityPicker";
import CommentDialog from "@/components/CommentDialog";

import { useDocumentSocket } from "@/hooks/useDocumentSocket";
import { getDoc, patchDocMeta, createDoc, deleteDoc } from "@/lib/api";

const RichEditor = dynamic(() => import("@/components/Editor"), { ssr: false });

/** Clipboard API first, then the older copy command for contexts that block it. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

export default function DocPage() {
  // ───────────────────────────── routing / ids ─────────────────────────────
  const params = useParams();
  const router = useRouter();
  const docId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string) ?? "default";

  // ──────────────────────────────── UI state ───────────────────────────────
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [sidebarMinified, setSidebarMinified] = useState(false);
  const [showRevs, setShowRevs] = useState(false);

  // ─────────────────────────────── meta state ──────────────────────────────
  const [title, setTitle] = useState<string>("");
  const [visibility, setVisibility] = useState<"private" | "team" | "public">("private");
  const [savingMeta, setSavingMeta] = useState<false | "title" | "visibility">(false);

  // ─────────────────────────── realtime/doc state ──────────────────────────
  const {
    loadState,
    docMeta,
    commentDraft,
    submitComment,
    cancelComment,
    initialHTML,
    peers,
    comments,
    highlightedIds,
    online,
    saveState,
    bubble,
    toggleHighlight,
    addComment,
    deleteComment,
    handleEditorChange,
    showResolved,
    setShowResolved,
    resolveComment,
    restoreRevisionById,
  } = useDocumentSocket(docId);

  // Avoid re-rendering the editor on peers object identity changes
  const peersList = useMemo(() => Object.values(peers), [peers]);

  // ───────────────────────── keyboard: toggle history ──────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShowRevs(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isOwner = !!docMeta?.isOwner;
  const canEdit = !!docMeta?.canEdit;
  const canComment = !!docMeta?.canComment;

  // ─────────────────────────────── load meta ───────────────────────────────
  const savedTitleRef = useRef<string>("");
  useEffect(() => {
    if (!docMeta) return;
    savedTitleRef.current = docMeta.title;
    setTitle(docMeta.title);
    setVisibility(docMeta.visibility);
  }, [docMeta]);

  // ─────────────────────────── save title (debounced) ──────────────────────
  useEffect(() => {
    if (!isOwner || !title || title === savedTitleRef.current) return;
    const t = setTimeout(async () => {
      try {
        setSavingMeta("title");
        await patchDocMeta(docId, { title });
        savedTitleRef.current = title;
      } catch {
        toast("Couldn’t save the title");
      } finally {
        setSavingMeta(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [docId, title, isOwner]);

  // ────────────────────────────── handlers ─────────────────────────────────
  async function handleChangeVisibility(v: "private" | "team" | "public") {
    const old = visibility;
    try {
      setVisibility(v);
      setSavingMeta("visibility");
      await patchDocMeta(docId, { visibility: v });
    } catch (e: any) {
      setVisibility(old);
      toast(e?.message ?? "Failed to update visibility");
    } finally {
      setSavingMeta(false);
    }
  }

  async function copyPublicLink() {
    const url = `${window.location.origin}/p/${docId}`;
    const copied = await copyText(url);
    toast(copied ? "Public link copied!" : `Couldn’t copy. Link: ${url}`);
  }

  async function handleDuplicate() {
    try {
      const src = await getDoc(docId);
      const baseTitle = `Copy of ${src?.title ?? "Untitled"}`;

      // Copies start private, even when the original is public.
      const clone = await createDoc(baseTitle, String(src?.content ?? "<p></p>"), "private");

      toast("Duplicated");
      router.push(`/docs/${clone.id}`);
    } catch (e) {
      toast("Couldn’t duplicate");
      console.error(e);
    }
  }

  async function handleMoveToTrash() {
    if (!confirm("Move this document to Trash?")) return;
    try {
      await deleteDoc(docId);
      toast("Moved to Trash");
      router.push("/docs");
    } catch {
      toast("Couldn’t move to Trash");
    }
  }

  // ─────────────────────────────── render ──────────────────────────────────
  if (loadState === "denied") {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="mb-2 text-lg font-semibold text-fg">You can’t open this document</h1>
        <p className="mb-4 text-sm text-muted">It’s private, in the Trash, or no longer exists.</p>
        <Link href="/docs" className="text-sm underline">Back to Docs</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] p-1 sm:p-6">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            readOnly={!isOwner}
            title={isOwner ? undefined : "Only the owner can rename this document"}
            className="w-full min-w-0 sm:min-w-[200px] rounded-md border border-zinc-200 bg-transparent px-2.5 py-1.5 text-base font-semibold outline-none ring-0 focus:border-zinc-300 read-only:cursor-default read-only:border-transparent dark:border-zinc-700"
          />
          <div className="text-xs text-zinc-500">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved"}
            {saveState === "error" && "Save error"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDuplicate}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Duplicate
          </button>

          {isOwner && (
            <>
              <button
                onClick={handleMoveToTrash}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Move to Trash
              </button>

              <VisibilityPicker
                value={visibility}
                onChange={handleChangeVisibility}
                disabled={!!savingMeta}
              />
            </>
          )}

          <div className="ml-2 flex items-center gap-2">
            <span className="text-xs text-zinc-500">Share:</span>
            <button
              onClick={copyPublicLink}
              disabled={visibility !== "public"}
              title={visibility !== "public" ? "Set to Public first" : "Copy link"}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Copy link
            </button>
          </div>

          {canEdit && (
            <button
              onClick={() => setShowRevs(true)}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              History
            </button>
          )}
        </div>
      </div>

      {/* Presence */}
      <div className="mb-3 text-xs text-zinc-500">
        <PresenceBar peers={peers} count={online.length} />
      </div>

      {/* Selection bubble */}
      {bubble.visible && canComment && !commentDraft && (
        <button
          onClick={addComment}
          className="fixed z-50 -translate-x-1/2 -translate-y-[120%] rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{ top: `${bubble.y}px`, left: `${bubble.x}px` }}
        >
          Add comment
        </button>
      )}

      {/* Editor + Comments */}
      <div className={`grid grid-cols-1 gap-4 ${sidebarMinified ? "md:grid-cols-[1fr_36px]" : "md:grid-cols-[1fr_280px]"}`}>
        <div>
          <RichEditor
            initialHTML={initialHTML}
            onChange={handleEditorChange}
            peers={peersList}
            readOnly={!canEdit}
          />
        </div>

        <CommentsSidebar
          comments={comments}
          highlightedIds={highlightedIds}
          toggleHighlight={toggleHighlight}
          deleteComment={isOwner ? deleteComment : undefined}
          resolveComment={isOwner ? resolveComment : undefined}
          onAddComment={canComment ? addComment : undefined}
          showResolved={showResolved}
          onToggleShowResolved={() => setShowResolved((s) => !s)}
          collapsed={!commentsOpen}
          onToggleCollapse={() => setCommentsOpen((o) => !o)}
          minified={sidebarMinified}
          onToggleMinified={() => setSidebarMinified((m) => !m)}
        />
      </div>

      {/* Revisions panel / history */}
      <RevisionsPanel
        docId={docId}
        open={showRevs}
        onClose={() => setShowRevs(false)}
        onRestore={async (revId) => {
          await restoreRevisionById(revId);
          setShowRevs(false);
        }}
      />

      {commentDraft && (
        <CommentDialog
          anchorText={commentDraft.anchorText}
          onSubmit={submitComment}
          onCancel={cancelComment}
        />
      )}

      <ToastContainer />
    </div>
  );
}
