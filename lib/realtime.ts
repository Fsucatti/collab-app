// lib/realtime.ts
// Client for the realtime Worker (realtime-worker/): named events over a plain WebSocket,
// with reconnection. A new token is requested on every connection, so reconnecting
// never reuses an expired one.

type Handler = (data: any) => void;

export type RealtimeConnection = {
  readonly connected: boolean;
  on: (event: string, handler: Handler) => void;
  emit: (event: string, data?: unknown) => void;
  disconnect: () => void;
};

const KEEPALIVE_MS = 30_000;
const MAX_RETRY_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;

export function connectRealtime(
  baseUrl: string,
  docId: string,
  getToken: () => Promise<string | null>
): RealtimeConnection {
  const url = `${baseUrl.replace(/^http/, "ws").replace(/\/$/, "")}/doc/${encodeURIComponent(docId)}`;
  const handlers = new Map<string, Handler[]>();

  let socket: WebSocket | null = null;
  let closed = false;
  let attempts = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const fire = (event: string, data?: unknown) => {
    for (const handler of handlers.get(event) ?? []) handler(data);
  };

  const scheduleRetry = () => {
    if (closed) return;
    const delay = Math.min(1000 * 2 ** attempts, MAX_RETRY_MS) * (0.5 + Math.random() / 2);
    attempts += 1;
    retryTimer = setTimeout(open, delay);
  };

  async function open() {
    let token: string | null = null;
    try {
      token = await getToken();
    } catch {
      // Treated like a missing token: try again later.
    }
    if (closed) return;
    if (!token) {
      scheduleRetry();
      return;
    }

    const ws = new WebSocket(url, ["collab", token]);
    socket = ws;

    // A handshake that never completes wouldn't fire onclose for a long time.
    const connectTimeout = setTimeout(() => ws.close(), CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      clearTimeout(connectTimeout);
      attempts = 0;
      keepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, KEEPALIVE_MS);
      fire("connect");
    };
    ws.onmessage = (message) => {
      if (message.data === "pong") return;
      try {
        const { e, d } = JSON.parse(String(message.data));
        fire(e, d);
      } catch {
        // Ignore anything that isn't one of our messages.
      }
    };
    ws.onclose = () => {
      clearTimeout(connectTimeout);
      if (keepalive) clearInterval(keepalive);
      keepalive = null;
      if (socket === ws) socket = null;
      scheduleRetry();
    };
  }

  void open();

  return {
    get connected() {
      return socket?.readyState === WebSocket.OPEN;
    },
    on(event, handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    emit(event, data) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ e: event, d: data }));
      }
    },
    disconnect() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (keepalive) clearInterval(keepalive);
      socket?.close();
      socket = null;
    },
  };
}
