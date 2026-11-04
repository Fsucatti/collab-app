// Realtime server for collab: one Durable Object per document.
//
// The Worker authenticates every connection at the edge, before a Durable Object
// is created. Rooms only relay messages between people: the app's database stays
// the source of truth, so nothing here is written to storage.
import { DurableObject } from "cloudflare:workers";
import sanitizeHtml from "sanitize-html";

export type Env = {
  ROOMS: DurableObjectNamespace<DocRoom>;
  REALTIME_HMAC_SECRET?: string;
  /** Comma-separated exact origins. An entry may start with `*.` to match a suffix. */
  ALLOWED_ORIGINS: string;
};

type Claims = {
  sub: string;
  name?: string;
  role?: "view" | "edit";
  docId?: string | null;
  exp?: number;
  scope?: string;
};

type Peer = {
  userId: string;
  name: string;
  color: string;
  role: "view" | "edit";
  joined: boolean;
};

const SUBPROTOCOL = "collab";
const MAX_DOC_HTML_CHARS = 400_000;
const PATCH_RATE_LIMIT_MS = 50;
const COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#14b8a6", "#ec4899"];
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s",
    "ul", "ol", "li",
    "h1", "h2", "h3", "blockquote", "code", "pre", "hr", "span", "a",
  ],
  allowedAttributes: { a: ["href", "title", "target", "rel"], span: ["style"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
};

function colorFor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Verifies the HMAC-signed token issued by the app's POST /api/realtime/token. */
export async function verifyToken(token: string, secret: string): Promise<Claims | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;

    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as Claims;
    if (typeof claims.exp !== "number" || Date.now() > claims.exp) return null;
    if (claims.scope !== "realtime" || !claims.docId) return null;
    return claims;
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string | null, allowed: string) {
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return allowed.split(",").map((entry) => entry.trim()).filter(Boolean).some((entry) =>
    entry.startsWith("*.") ? host.endsWith(entry.slice(1)) : origin === entry
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok");

    const match = url.pathname.match(/^\/doc\/([^/]+)$/);
    if (!match) return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }
    if (!isAllowedOrigin(request.headers.get("Origin"), env.ALLOWED_ORIGINS)) {
      return new Response("Origin not allowed", { status: 403 });
    }
    // Fail closed: without the secret nobody can be authenticated.
    if (!env.REALTIME_HMAC_SECRET) return new Response("Not configured", { status: 500 });

    // Browsers can't set headers on a WebSocket, and a query string would end up in
    // logs, so the token travels as a subprotocol: new WebSocket(url, ["collab", token]).
    const protocols = (request.headers.get("Sec-WebSocket-Protocol") ?? "").split(",").map((p) => p.trim());
    if (protocols[0] !== SUBPROTOCOL || !protocols[1]) return new Response("Unauthorized", { status: 401 });

    const docId = decodeURIComponent(match[1]);
    const claims = await verifyToken(protocols[1], env.REALTIME_HMAC_SECRET);
    if (!claims || claims.docId !== docId) return new Response("Unauthorized", { status: 401 });

    // Durable Objects aren't reachable from the internet, so this header can't be forged.
    const headers = new Headers(request.headers);
    headers.set("X-Claims", JSON.stringify(claims));
    const room = env.ROOMS.get(env.ROOMS.idFromName(docId));
    return room.fetch(new Request(request, { headers }));
  },
} satisfies ExportedHandler<Env>;

export class DocRoom extends DurableObject<Env> {
  // Latest content while a room is awake. After hibernation it is empty, and the
  // client that joins next sends what it loaded from the database.
  private content = "";
  private lastPatchAt = new WeakMap<WebSocket, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Answers keepalives without waking the room or counting as a billed message.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request: Request): Promise<Response> {
    const claims = JSON.parse(request.headers.get("X-Claims") ?? "{}") as Claims;
    const userId = `u-${claims.sub}`;
    const peer: Peer = {
      userId,
      name: claims.name || `Viewer-${userId.slice(-4)}`,
      color: colorFor(userId),
      role: claims.role === "edit" ? "edit" : "view",
      joined: false,
    };

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(peer);

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": SUBPROTOCOL },
    });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string") return;
    let message: { e?: string; d?: any };
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    const peer = ws.deserializeAttachment() as Peer;

    if (message.e === "join") {
      peer.joined = true;
      ws.serializeAttachment(peer);
      this.send(ws, "doc:init", this.content);
      this.broadcastPresence();
      return;
    }

    // Read-only viewers can watch, but nothing they send reaches other people.
    if (!peer.joined || peer.role !== "edit") return;

    switch (message.e) {
      case "doc:patch": {
        const now = Date.now();
        if (now - (this.lastPatchAt.get(ws) ?? 0) < PATCH_RATE_LIMIT_MS) return;
        this.lastPatchAt.set(ws, now);

        const content = String(message.d?.content ?? "");
        // Dropped instead of truncated: cutting HTML would corrupt the document.
        if (content.length > MAX_DOC_HTML_CHARS) return;

        const clean = sanitizeHtml(content, SANITIZE);
        if (clean === this.content) return;
        this.content = clean;
        this.broadcast("doc:update", clean, ws);
        return;
      }
      case "cursor":
        this.broadcast(
          "cursor",
          { userId: peer.userId, name: peer.name, color: peer.color, from: message.d?.from, to: message.d?.to },
          ws
        );
        return;
      case "comment:new":
        this.broadcast("comment:new", message.d?.comment, ws);
        return;
      case "comment:delete":
      case "comment:resolve":
        this.broadcast(message.e, message.d, ws);
        return;
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.handleLeave(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.handleLeave(ws);
  }

  private handleLeave(leaving: WebSocket) {
    const remaining = this.ctx.getWebSockets().filter((ws) => ws !== leaving);
    if (remaining.length === 0) this.content = "";
    this.broadcastPresence(leaving);
  }

  private send(ws: WebSocket, event: string, data: unknown) {
    try {
      ws.send(JSON.stringify({ e: event, d: data }));
    } catch {
      // The socket is closing; webSocketClose handles it.
    }
  }

  private broadcast(event: string, data: unknown, except?: WebSocket) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      if ((ws.deserializeAttachment() as Peer).joined) this.send(ws, event, data);
    }
  }

  private broadcastPresence(except?: WebSocket) {
    const sockets = this.ctx.getWebSockets().filter((ws) => ws !== except);
    const users = new Set<string>();
    for (const ws of sockets) {
      const peer = ws.deserializeAttachment() as Peer;
      if (peer.joined) users.add(peer.userId);
    }
    this.broadcast("presence", Array.from(users), except);
  }
}
