"use client";
import type { PeerCursor } from "@/lib/types";

export default function PresenceBar({
  peers,
  count,
}: {
  peers: Record<string, PeerCursor>;
  count: number;
}) {
  const list = Object.values(peers);

  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="opacity-90">Online: {count}</span>
      <div className="flex flex-wrap gap-2">
        {list.map((p) => (
          <span
            key={p.userId}
            title={p.name}
            className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-[12px] bg-card"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: p.color }}
            />
            <span className="text-fg">{p.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
