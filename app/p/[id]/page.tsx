// app/p/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const RichEditor = dynamic(() => import("@/components/Editor"), { ssr: false });


export default function PublicDocPage() {
  const params = useParams();
  const docId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string) ?? "";

  const [html, setHtml] = useState<string>("<p></p>");
  const [title, setTitle] = useState<string>("");
  const [canSubscribe, setCanSubscribe] = useState(false);   // NEW
  const socketRef = useRef<Socket | null>(null);

  // initial fetch (public-only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!docId) return;
      const res = await fetch(`/api/public/docs/${docId}`, { cache: "no-store" });
      if (!res.ok) {
        if (!cancelled) {
          setTitle("Not found");
          setHtml("<p>Document is not public or does not exist.</p>");
          setCanSubscribe(false);
        }
        return;
      }
      const doc = await res.json();
      if (!cancelled) {
        setTitle(doc.title || "");
        setHtml(doc.content || "<p></p>");
        setCanSubscribe(true);           // only subscribe when confirmed public
      }
    })();
    return () => { cancelled = true; };
  }, [docId]);

  // subscribe to realtime updates (read-only)
  useEffect(() => {
    if (!docId || !canSubscribe) return; // gate join
    const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3001";
    const socket = io(REALTIME_URL, {
      transports: ["websocket"],
      query: { userId: `pub-${Math.random().toString(36).slice(2,8)}`, name: "Viewer" },
    });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("join", docId));
    socket.on("doc:init", (content: string) => {
      if (content) (window as any).__activeTiptapEditor?.applyRemoteHTML?.(content);
    });
    socket.on("doc:update", (content: string) => {
      (window as any).__activeTiptapEditor?.applyRemoteHTML?.(content);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [docId, canSubscribe]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>{title || "Public doc"}</h1>
      <RichEditor initialHTML={html} onChange={() => {}} readOnly />
    </div>
  );
}
