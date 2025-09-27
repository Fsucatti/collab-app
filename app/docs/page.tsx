// app/docs/page.tsx
import { Suspense } from "react";
import DocsListClient from "./DocsListClient";

export const dynamic = "force-dynamic"; // optional: prevents static export/prerender issues

export default function DocsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted">Loading…</div>}>
      <DocsListClient />
    </Suspense>
  );
}
