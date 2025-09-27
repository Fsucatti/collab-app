// lib/validation.ts
import { z } from "zod";

// Reuse across routes
export const DocIdParam = z.object({
  id: z.string().min(1).max(128),
});

export const UpsertDocBody = z.object({
  title: z.string().min(1).max(256).optional(),
  content: z.string().min(0).max(500_000).default(""),
});

export const PatchDocBody = z.object({
  content: z.string().min(0).max(500_000),
});

// Creation has more optional fields
export const CreateDocBody = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  visibility: z.enum(["private", "workspace", "public"]).optional(),
});

export const UpdateDocMetaBody = z.object({
  title: z.string().max(200).optional(),
  visibility: z.enum(["private", "workspace", "public"]).optional(),
}).refine((d) => d.title !== undefined || d.visibility !== undefined, {
  message: "No changes provided",
});

export const DocListQuery = z.object({
  q: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  includeDeleted: z.coerce.boolean().optional().default(false),
});
// Comments
export const CreateCommentBody = z.object({
  author: z.string().min(1).max(128).default("Anon"),
  content: z.string().min(1).max(10_000),           // plain text (UI renders in <div>)
  rangeFrom: z.number().int().nonnegative(),
  rangeTo: z.number().int().nonnegative(),
  // If your Prisma model includes these, keep them in the body (we’ll sanitize),
  // otherwise it's fine to accept them and simply not persist them.
  anchorText: z.string().min(0).max(2_000).optional(),
  contextBefore: z.string().min(0).max(2_000).optional(),
  contextAfter: z.string().min(0).max(2_000).optional(),
}).refine(b => b.rangeFrom < b.rangeTo, {
  path: ["rangeTo"],
  message: "rangeTo must be greater than rangeFrom",
});

export const CommentIdParam = z.object({
  commentId: z.string().min(1),
});

export const PatchCommentBody = z.object({
  resolved: z.boolean(),
});
