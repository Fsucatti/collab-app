// hooks/useDocumentSocket.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { PeerCursor, CommentItem } from "@/lib/types";
import { toast } from "@/components/Toast";
import { getIdentity } from "@/lib/identity";
import {
  getDoc,
  putDoc,
  patchDoc,
  getComments as apiGetComments,
  postComment as apiPostComment,
  deleteCommentApi,
  patchComment,
  restoreRevision,
} from "@/lib/api";

export function useDocumentSocket(docId: string) {
  // ─────────────────────────── state ───────────────────────────
  const [initialHTML, setInitialHTML] = useState("<p></p>");
  const [online, setOnline] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [peers, setPeers] = useState<Record<string, PeerCursor>>({});
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [bubble, setBubble] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });

  // ─────────────────────────── refs ────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const didInitSocket = useRef(false);
  const identity = getIdentity();
  const userId = useRef(identity.userId);
  const displayName = useRef(identity.name);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);
  const lastKnownHTML = useRef<string>("");
  const docIdRef = useRef(docId);
  const lastUserSelectionAt = useRef<number>(0);
  const readyToJoinRef = useRef(false);

  // patch throttle
  const THROTTLE_MS = 220;
  const lastEmitAtRef = useRef(0);
  const throttlerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestHtmlRef = useRef<string>("");
  const lastSentHTMLRef = useRef<string>("");

  const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3001";
  useEffect(() => { docIdRef.current = docId; }, [docId]);

  // ───────────────────────── highlights bridge ─────────────────
  const pushHighlightsToEditor = useCallback(() => {
    const bridge = (window as any).__activeTiptapEditor;
    if (!bridge?.setCommentHighlights) return;

    const items = comments
      .filter((c) => highlightedIds.has(c.id))
      .map((c) => ({
        rangeFrom: c.rangeFrom,
        rangeTo: c.rangeTo,
        anchorText: (c as any).anchorText,
        contextBefore: (c as any).contextBefore,
        contextAfter: (c as any).contextAfter,
      }));

    bridge.setCommentHighlights(items); // [] clears
  }, [comments, highlightedIds]);

  // ───────────────────── load doc (ONE effect), then allow join ────────────────
  useEffect(() => {
    if (!docId) return;

    let cancelled = false;
    (async () => {
      // 1) load/create doc
      const doc = await getDoc(docId);
      if (!doc) {
        const put = await putDoc(docId, docId, "<p></p>");
        if (!put.ok) return;
        setInitialHTML("<p></p>");
        lastKnownHTML.current = "<p></p>";
      } else {
        const html = String(doc.content || "<p></p>");
        setInitialHTML(html);
        lastKnownHTML.current = html;

        latestHtmlRef.current = html;
      lastSentHTMLRef.current = html;
      }

      if (cancelled) return;

      // 2) mark as ready to join
      readyToJoinRef.current = true;

      // 3) if socket is already connected, join now
      const sock = socketRef.current;
      if (sock?.connected) sock.emit("join", docId);
    })();

    return () => { cancelled = true; };
  }, [docId]);

  // ───────────────────── load comments ─────────────────────
  useEffect(() => {
    if (!docId) return;
    (async () => {
      const list = await apiGetComments(docId);
      setComments(list);
    })();
  }, [docId]);

  // ───────────────────── socket: low-level emit now ─────────────────────
  const emitPatchNow = useCallback(() => {
    const sock = socketRef.current;
    if (!sock) return;
    const html = latestHtmlRef.current;

    if (html === lastSentHTMLRef.current) return; // dedupe
    lastSentHTMLRef.current = html;

    sock.emit("doc:patch", { content: html });
    lastEmitAtRef.current = performance.now();
  }, []);

  // ───────────────────── socket: throttled emit wrapper ──────────────────
  const scheduleThrottledPatch = useCallback((html: string) => {
    latestHtmlRef.current = html;

    const now = performance.now();
    const elapsed = now - lastEmitAtRef.current;

    if (elapsed >= THROTTLE_MS && !throttlerRef.current) {
      emitPatchNow(); // leading
      return;
    }

    if (!throttlerRef.current) {
      throttlerRef.current = setTimeout(() => {
        throttlerRef.current = null;
        emitPatchNow(); // trailing
      }, Math.max(THROTTLE_MS - elapsed, 0));
    }
  }, [emitPatchNow]);

  // ───────────────────── socket setup (once) ─────────────────────────────
  useEffect(() => {
    if (didInitSocket.current) return;
    didInitSocket.current = true;

    let cancelled = false;

    (async () => {
      let auth: Record<string, any> | undefined;
      try {
        // try editor token first
        const r = await fetch("/api/realtime/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docId: docIdRef.current, intent: "edit" }),
          cache: "no-store",
        });
        if (r.ok) {
          const { token } = await r.json();
          auth = { token };
        } else {
          // fallback viewer token
          const rv = await fetch("/api/realtime/token", { cache: "no-store" });
          if (rv.ok) {
            const { token } = await rv.json();
            auth = { token };
          }
        }
      } catch { /* anonymous viewer */ }

      if (cancelled) return;

      const socket = io(REALTIME_URL, {
        transports: ["websocket"],
        auth,
        query: { userId: userId.current, name: displayName.current }, // labels only
      });
      socketRef.current = socket;

      // connect/reconnect → join only when ready
      socket.on("connect", () => {
        const id = docIdRef.current;
        if (id && readyToJoinRef.current) socket.emit("join", id);
      });
      socket.io.on("reconnect", () => {
        const id = docIdRef.current;
        if (id && readyToJoinRef.current) socket.emit("join", id);
      });

      // payload handlers
      const onCursor = (payload: PeerCursor) => {
        setPeers((prev) => ({ ...prev, [payload.userId]: payload }));
      };
      const onInit = (html: string) => {
        if ((html ?? "") === "" && lastKnownHTML.current) {
          socket.emit("doc:patch", { content: lastKnownHTML.current });
        } else {
          const val = html || "<p></p>";
          setInitialHTML(val);
          lastKnownHTML.current = val;
        }
      };
      const onUpdate = (html: string) => {
        const bridge = (window as any).__activeTiptapEditor;
        bridge?.applyRemoteHTML?.(html);
        lastKnownHTML.current = html;
        pushHighlightsToEditor();
      };
      const onPresence = (users: string[]) => setOnline(users);
      const onCommentNew = (comment: CommentItem) => {
        setComments((prev) => (prev.some((c) => c.id === comment.id) ? prev : [comment, ...prev]));
      };
      const onCommentDelete = ({ id }: { id: string }) => {
        setComments((prev) => prev.filter((c) => c.id !== id));
      };
      const onCommentResolve = (payload: { id: string; resolved: boolean; resolvedAt?: string; resolvedBy?: string }) => {
        setComments(prev => prev.map(c => c.id === payload.id ? {
          ...c,
          resolved: payload.resolved,
          resolvedAt: payload.resolvedAt ?? c.resolvedAt,
          resolvedBy: payload.resolvedBy ?? c.resolvedBy,
        } : c));
      };

      socket.on("cursor", onCursor);
      socket.on("doc:init", onInit);
      socket.on("doc:update", onUpdate);
      socket.on("presence", onPresence);
      socket.on("comment:new", onCommentNew);
      socket.on("comment:delete", onCommentDelete);
      socket.on("comment:resolve", onCommentResolve);

      (window as any).__emitCursor = (from: number, to: number) => {
        socket.emit("cursor", { from, to });
      };
    })();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.off("cursor");
        socket.off("doc:init");
        socket.off("doc:update");
        socket.off("presence");
        socket.off("comment:new");
        socket.off("comment:delete");
        socket.off("comment:resolve");
        socket.disconnect();
        socketRef.current = null;
      }
      delete (window as any).__emitCursor;
      didInitSocket.current = false;
    };
  }, [pushHighlightsToEditor, REALTIME_URL]);

  // ───────────────────── when docId changes, (re)join if ready ─────────────
  useEffect(() => {
    const sock = socketRef.current;
    if (!docId || !sock) return;
    if (sock.connected && readyToJoinRef.current) {
      sock.emit("join", docId);
    }
  }, [docId]);

  // ───────────────────── editor bridges & highlights lifecycle ─────────────
  useEffect(() => {
    (window as any).__applyRemoteHTML = (html: string) => {
      const editorAny = (window as any).__activeTiptapEditor;
      editorAny?.applyRemoteHTML?.(html);
    };
    return () => { delete (window as any).__applyRemoteHTML; };
  }, []);

  useEffect(() => {
    (window as any).__onEditorReady = () => { pushHighlightsToEditor(); };
    return () => { delete (window as any).__onEditorReady; };
  }, [pushHighlightsToEditor]);

  useEffect(() => {
    setHighlightedIds(prev => {
      const valid = new Set(comments.map(c => c.id));
      const next = new Set<string>();
      for (const id of prev) if (valid.has(id)) next.add(id);
      // keep same Set instance if identical
      if (next.size === prev.size) {
        let same = true;
        for (const id of prev) { if (!next.has(id)) { same = false; break; } }
        if (same) return prev;
      }
      return next;
    });
  }, [comments]);

  useEffect(() => { pushHighlightsToEditor(); }, [comments, highlightedIds, pushHighlightsToEditor]);

  useEffect(() => {
    return () => { (window as any).__activeTiptapEditor?.setCommentHighlights?.([]); };
  }, []);

  // ───────────────────── selection bubble ────────────────────────────────
  useEffect(() => {
    (window as any).__onEditorSelection = ({ from, to }: { from: number; to: number }) => {
      if (from === to) { setBubble((b) => ({ ...b, visible: false })); return; }
      lastUserSelectionAt.current = Date.now();
      const sel = window.getSelection?.();
      if (!sel || sel.rangeCount === 0) { setBubble((b) => ({ ...b, visible: false })); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setBubble({ visible: true, x: rect.left + rect.width / 2, y: Math.max(0, rect.top - 8) });
    };
    return () => { delete (window as any).__onEditorSelection; };
  }, []);

  // ───────────────────── autosave (debounced) ─────────────────────────────
  const scheduleSave = (html: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await patchDoc(docId, html);
        if (!res.ok) throw new Error("save failed");
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 800);
        lastKnownHTML.current = html;
      } catch {
        setSaveState("error");
        toast("Save failed. Check your connection.");
      }
    }, 600);
  };

  // ───────────────────── editor -> broadcast + save ───────────────────────
  const handleEditorChange = (html: string) => {
    // If editor fires with the same content we already know, don’t patch/save.
    if (html === lastKnownHTML.current) return;

    scheduleThrottledPatch(html);
    scheduleSave(html);
    pushHighlightsToEditor();
  };

  // flush trailing throttle on unload/unmount
  useEffect(() => {
    const flush = () => {
      if (throttlerRef.current) {
        clearTimeout(throttlerRef.current);
        throttlerRef.current = null;
        emitPatchNow();
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [emitPatchNow]);

  // ───────────────────── comments: add / delete / resolve ─────────────────
  const addComment = useCallback(async () => {
    const bridge = (window as any).__activeTiptapEditor;
    const sel = bridge?.getSelection?.() ?? { from: 0, to: 0 };
    const anchorText: string = bridge?.getTextBetween?.(sel.from, sel.to) ?? "";
    const before: string = bridge?.getTextBetween?.(Math.max(0, sel.from - 60), sel.from) ?? "";
    const after: string = bridge?.getTextBetween?.(sel.to, sel.to + 60) ?? "";

    const isFocused = !!bridge?.isFocused?.();
    const recentMs = Date.now() - lastUserSelectionAt.current;

    const selectionLooksFresh =
      sel.from < sel.to && anchorText.trim().length > 0 && (isFocused || recentMs < 3000);

    if (!selectionLooksFresh) { toast("Select text to comment on."); return; }

    const content = prompt("New comment?");
    if (!content) return;

    try {
      const item = await apiPostComment(docId, {
        content,
        author: displayName.current,
        rangeFrom: sel.from,
        rangeTo: sel.to,
        anchorText,
        contextBefore: before,
        contextAfter: after,
      });
      setComments(prev => [item, ...prev]);
      socketRef.current?.emit("comment:new", { docId, comment: item });
    } catch {
      toast("Couldn’t add comment.");
    }
  }, [docId]);

  const jumpTo = useCallback((dir: "next" | "prev") => {
    const bridge = (window as any).__activeTiptapEditor;
    if (!bridge?.revealRange) return;

    const list = (showResolved ? comments : comments.filter(c => !c.resolved))
      .slice()
      .sort((a, b) => a.rangeFrom - b.rangeFrom);

    if (list.length === 0) return;

    const sel = bridge?.getSelection?.() ?? { from: 0, to: 0 };
    const cursor = sel.to;

    let idx: number;
    if (dir === "next") {
      idx = list.findIndex(c => c.rangeFrom > cursor);
      if (idx === -1) idx = 0;
    } else {
      idx = -1;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].rangeTo < cursor) { idx = i; break; }
      }
      if (idx === -1) idx = list.length - 1;
    }

    const c = list[idx];
    bridge.revealRange(c.rangeFrom, c.rangeTo);
  }, [comments, showResolved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag && /^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        addComment();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setHighlightedIds(new Set());
        setBubble(b => ({ ...b, visible: false }));
        return;
      }
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        jumpTo("next");
        return;
      }
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        jumpTo("prev");
        return;
      }
    };

    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [addComment, jumpTo]);

  async function deleteComment(id: string) {
    if (!docId) return;
    setComments((prev) => prev.filter((c) => c.id !== id));
    const res = await deleteCommentApi(docId, id);
    if (!res.ok) return;
    socketRef.current?.emit("comment:delete", { id });
  }

  async function resolveComment(id: string, resolved: boolean) {
    setComments(prev => prev.map(c => c.id === id ? {
      ...c, resolved,
      resolvedAt: resolved ? new Date().toISOString() : null,
      resolvedBy: resolved ? "You" : null,
    } : c));

    try {
      const updated = await patchComment(docId, id, { resolved });
      setComments(prev => prev.map(c => c.id === id ? updated : c));
      socketRef.current?.emit("comment:resolve", {
        id, resolved, resolvedAt: updated.resolvedAt, resolvedBy: updated.resolvedBy
      });
    } catch {
      setComments(prev => prev.map(c => c.id === id ? { ...c, resolved: !resolved } : c));
    }
  }

  // ───────────────────── revisions: restore ───────────────────────────────
  async function restoreRevisionById(revId: string) {
    try {
      const content = await restoreRevision(docIdRef.current, revId);

      const bridge = (window as any).__activeTiptapEditor;
      bridge?.applyRemoteHTML?.(content);
      lastKnownHTML.current = String(content ?? "");

      latestHtmlRef.current = String(content ?? "");
      if (throttlerRef.current) {
        clearTimeout(throttlerRef.current);
        throttlerRef.current = null;
      }
      emitPatchNow(); // immediately update room state

      pushHighlightsToEditor();
    } catch {
      toast("Failed to restore revision.");
    }
  }

  // ───────────────────── exports ─────────────────────────────
  const toggleHighlight = useCallback((id: string) => {
    setHighlightedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return {
    initialHTML,
    peers,
    comments,
    highlightedIds,
    online,
    saveState,
    bubble,
    resolveComment,
    toggleHighlight,
    addComment,
    deleteComment,
    handleEditorChange,
    showResolved,
    setShowResolved,
    restoreRevisionById,
  };
}
