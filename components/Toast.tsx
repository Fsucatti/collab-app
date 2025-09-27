"use client";
import { useEffect, useState } from "react";

type Note = { id: number; text: string };
let push: ((t: string) => void) | null = null;

export function toast(msg: string) {
  push?.(msg);
}

export default function ToastContainer() {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    push = (text: string) => {
      const id = Date.now();
      setNotes((prev) => [...prev, { id, text }]);
      setTimeout(() => {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }, 2500);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex flex-col gap-2">
      {notes.map((n) => (
        <div
          key={n.id}
          className="
            pointer-events-auto animate-in fade-in slide-in-from-bottom-2
            rounded-lg border border-border bg-card px-3 py-2 text-sm text-fg shadow-lg
          "
        >
          {n.text}
        </div>
      ))}
    </div>
  );
}
