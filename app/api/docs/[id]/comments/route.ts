import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sanitizePlainText } from "@/lib/sanitize";

// shared helpers
async function readJsonSafe(req: Request) {
  const text = await req.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const CommentCreate = z.object({
  content: z.string().trim().min(1).max(4000),
  author: z.string().trim().min(1).max(120),
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
  const cleanAuthor = sanitizePlainText(v.author);
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
