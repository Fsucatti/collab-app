// realtime/src/index.ts
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import sanitizeHtml from "sanitize-html";
import crypto from "node:crypto";
// ───────────────────────── config ─────────────────────────
const PORT = Number(process.env.PORT ?? 3001);
// 👇 NEW: dynamic origin config
const PROD_APP_ORIGIN = process.env.PROD_APP_ORIGIN || "https://your-app.vercel.app";
const PREVIEW_REGEX = /\.vercel\.app$/; // allow any preview
const ALLOW_LOCALHOST = process.env.ALLOW_LOCALHOST !== "false"; // default true
const EXTRA_ORIGINS = (process.env.EXTRA_ORIGINS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
function isAllowedOrigin(origin) {
    // Some requests (same-origin, curl/health) have no Origin header → allow
    if (!origin)
        return true;
    try {
        const url = new URL(origin);
        // Exact prod
        if (url.origin === PROD_APP_ORIGIN)
            return true;
        // Any *.vercel.app (preview deployments)
        if (PREVIEW_REGEX.test(url.hostname))
            return true;
        // Local dev
        if (ALLOW_LOCALHOST &&
            (url.origin === "http://localhost:3000" || url.origin === "http://127.0.0.1:3000"))
            return true;
        // Extra explicit origins via env
        if (EXTRA_ORIGINS.includes(url.origin))
            return true;
    }
    catch {
        // bad Origin string → deny
    }
    return false;
}
const corsOriginFn = (origin, cb) => {
    if (isAllowedOrigin(origin))
        return cb(null, true);
    cb(new Error(`CORS blocked for origin: ${origin}`));
};
const REALTIME_HMAC_SECRET = process.env.REALTIME_HMAC_SECRET || "dev-secret-change-me";
const MAX_DOC_HTML_CHARS = Number(process.env.MAX_DOC_HTML_CHARS ?? 400_000);
// Authenticated users can patch a little faster than anonymous
const RATE_AUTHED_MS = 50;
const RATE_ANON_MS = 220;
// ───────────────────────── infra ──────────────────────────
const app = express();
// 👇 use the origin function here
app.use(cors({ origin: corsOriginFn, credentials: true }));
app.get("/health", (_req, res) => res.status(200).send("ok"));
const httpServer = createServer(app);
// 👇 and here for Socket.IO
const io = new Server(httpServer, {
    cors: { origin: corsOriginFn, credentials: true },
});
function verifyToken(token) {
    if (!token)
        return null;
    const [body, sig] = token.split(".");
    if (!body || !sig)
        return null;
    const expected = crypto
        .createHmac("sha256", REALTIME_HMAC_SECRET)
        .update(body)
        .digest("base64url");
    if (expected !== sig)
        return null;
    try {
        const payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        if (typeof payload.exp === "number" && Date.now() > payload.exp)
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
const COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#14b8a6", "#ec4899"];
const SANITIZE = {
    allowedTags: [
        "p", "br", "strong", "em", "u", "s",
        "ul", "ol", "li",
        "h1", "h2", "h3", "blockquote", "code", "pre", "hr", "span", "a",
    ],
    allowedAttributes: { a: ["href", "title", "target", "rel"], span: ["style"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
};
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++)
    h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
function colorFor(uid) { return COLORS[Math.abs(hashCode(uid)) % COLORS.length]; }
function roomIdFor(docId) { return `doc:${docId}`; }
const docs = new Map();
const lastPatchAt = new Map();
function getDocState(roomId) {
    let s = docs.get(roomId);
    if (!s) {
        s = { content: "", users: new Set() };
        docs.set(roomId, s);
    }
    return s;
}
function broadcastPresence(roomId) {
    const state = docs.get(roomId);
    if (!state)
        return;
    io.to(roomId).emit("presence", Array.from(state.users));
}
// ───────────────────────── sockets ────────────────────────
io.on("connection", (socket) => {
    let currentRoomId = null;
    const rawToken = (socket.handshake.auth && socket.handshake.auth.token) ||
        socket.handshake.query?.token;
    const claims = verifyToken(typeof rawToken === "string" ? rawToken : undefined);
    const isAuthed = !!claims;
    const role = claims?.role === "edit" ? "edit" : "view";
    const tokenDocId = claims?.docId ?? null;
    const userId = isAuthed
        ? `u-${claims.sub}`
        : socket.handshake.query.userId || `anon-${socket.id.slice(0, 6)}`;
    const name = claims?.name || socket.handshake.query.name || `Viewer-${userId.slice(-4)}`;
    const color = colorFor(userId);
    const PATCH_RATE_LIMIT_MS = isAuthed ? RATE_AUTHED_MS : RATE_ANON_MS;
    function joinDoc(docId) {
        const newRoom = roomIdFor(docId);
        if (tokenDocId && tokenDocId !== docId)
            return;
        if (currentRoomId && currentRoomId !== newRoom) {
            socket.leave(currentRoomId);
            const old = docs.get(currentRoomId);
            old?.users.delete(userId);
            broadcastPresence(currentRoomId);
        }
        currentRoomId = newRoom;
        socket.join(currentRoomId);
        const state = getDocState(currentRoomId);
        state.users.add(userId);
        socket.emit("doc:init", state.content);
        broadcastPresence(currentRoomId);
    }
    socket.on("join", (docId) => { if (docId)
        joinDoc(docId); });
    socket.on("doc:patch", (patch) => {
        if (!currentRoomId)
            return;
        if (role !== "edit")
            return;
        const joinedDocId = currentRoomId.replace(/^doc:/, "");
        if (tokenDocId && tokenDocId !== joinedDocId)
            return;
        const state = docs.get(currentRoomId);
        if (!state)
            return;
        const now = Date.now();
        const last = lastPatchAt.get(socket.id) ?? 0;
        if (now - last < PATCH_RATE_LIMIT_MS)
            return;
        lastPatchAt.set(socket.id, now);
        let content = String(patch.content ?? "");
        if (content.length > MAX_DOC_HTML_CHARS)
            content = content.slice(0, MAX_DOC_HTML_CHARS);
        const clean = sanitizeHtml(content, SANITIZE);
        if (clean === state.content)
            return;
        state.content = clean;
        socket.to(currentRoomId).emit("doc:update", clean);
    });
    socket.on("cursor", (data) => {
        if (!currentRoomId)
            return;
        socket.to(currentRoomId).emit("cursor", { userId, name, color, from: data.from, to: data.to });
    });
    socket.on("comment:new", (payload) => {
        if (!currentRoomId)
            return;
        socket.to(currentRoomId).emit("comment:new", payload.comment);
    });
    socket.on("comment:delete", (payload) => {
        if (!currentRoomId)
            return;
        socket.to(currentRoomId).emit("comment:delete", payload);
    });
    socket.on("comment:resolve", (payload) => {
        if (!currentRoomId)
            return;
        socket.to(currentRoomId).emit("comment:resolve", payload);
    });
    socket.on("disconnect", () => {
        if (!currentRoomId)
            return;
        const s = docs.get(currentRoomId);
        s?.users.delete(userId);
        broadcastPresence(currentRoomId);
    });
});
// ───────────────────────── start ─────────────────────────
httpServer.listen(PORT, () => {
    console.log(`Realtime server on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map