// app/p/[id]/not-found.tsx
export default function NotFound() {
  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Not found</h1>
      <p style={{ opacity: 0.7 }}>
        This document is either private, deleted, or doesn’t exist.
      </p>
    </div>
  );
}
