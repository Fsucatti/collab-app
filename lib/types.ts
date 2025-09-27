export type PeerCursor = { userId: string; name: string; color: string; from: number; to: number };

export type CommentItem = {
  id: string;
  author: string;
  content: string;
  rangeFrom: number;
  rangeTo: number;
  createdAt: string;
  anchorText?: string;
  contextBefore?: string;
  contextAfter?: string;
  resolved?: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
};
