import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sanitizePlainText } from "@/lib/sanitize";
import { denied, getCurrentUser, getDocAccess } from "@/lib/permissions";

// shared helpers
async function readJsonSafe(req: Request) {
  const text = await req.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// The author is never read from the request: it comes from the session.
const CommentCreate = z.object({
  content: z.string().trim().min(1).max(4000),
  rangeFrom: z.number().int().nonnegative(),
  rangeTo: z.number().int().nonnegative(),
  anchorText: z.string().trim().max(2000).optional().default(""),
  contextBefore: z.string().trim().max(200).optional().default(""),
  contextAfter: z.string().trim().max(200).optional().default(""),
}).refine(v => v.rangeFrom < v.rangeTo, {
  message: "rangeFrom must be < rangeTo",
  path: ["rangeFrom"],
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const access = await getDocAccess(id, user?.id ?? null);
  if (!access.canRead) return denied(access, user?.id ?? null);

  const list = await prisma.comment.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(list);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const access = await getDocAccess(id, user?.id ?? null);
  if (!user || !access.canComment) return denied(access, user?.id ?? null);

  const raw = await readJsonSafe(req);
  const parsed = CommentCreate.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const v = parsed.data;

  // sanitize user-controlled strings
  const cleanContent = sanitizePlainText(v.content);
  const cleanAuthor = sanitizePlainText(user.name).slice(0, 120);
  const cleanAnchor = sanitizePlainText(v.anchorText ?? "");
  const cleanBefore = sanitizePlainText(v.contextBefore ?? "");
  const cleanAfter = sanitizePlainText(v.contextAfter ?? "");

  // clamp ranges defensively (should already be valid via Zod)
  const clamp = (n: number) => Math.max(0, Math.min(n, 10_000_000));
  const from = clamp(v.rangeFrom);
  const to = clamp(v.rangeTo);

  const item = await prisma.comment.create({
    data: {
      documentId: id,
      author: cleanAuthor,
      content: cleanContent,
      rangeFrom: from,
      rangeTo: to,
      anchorText: cleanAnchor,
      contextBefore: cleanBefore,
      contextAfter: cleanAfter,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
