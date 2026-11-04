# Collab Notes

A collaborative document editor with real-time editing, comments, revision history, GitHub sign-in, and public sharing.

| Part | Technology | Hosted on |
|---|---|---|
| Web app | Next.js 15 (App Router), TipTap, Tailwind CSS 4 | Vercel |
| Sign-in | NextAuth with database sessions | Vercel |
| Data | Prisma and Postgres | Neon |
| Realtime | Cloudflare Worker with one Durable Object per document | Cloudflare |

All of this runs on free plans, and that is a requirement for this project.

## Run it locally

You need Node 22 and pnpm. `next build` fails on Node 26 with a webpack hashing error.

1. Create the app settings and fill them in:

   ```bash
   cp .env.example .env
   ```

2. Start a database, or point `DATABASE_URL` at one of your own:

   ```bash
   docker compose up -d
   ```

3. Install dependencies and apply the migrations:

   ```bash
   pnpm install
   pnpm prisma migrate deploy
   ```

4. Start the realtime Worker in a second terminal. `REALTIME_HMAC_SECRET` must match in both places:

   ```bash
   cd realtime-worker
   cp .dev.vars.example .dev.vars
   npm install
   npm run dev
   ```

5. Start the app and open http://localhost:3000:

   ```bash
   pnpm dev
   ```

GitHub sign-in needs an [OAuth App](https://github.com/settings/developers) whose callback URL is `http://localhost:3000/api/auth/callback/github`.

## Permissions

All document rules live in `lib/permissions.ts`. API routes check them on the server, and `GET /api/docs/:id` returns the flags the UI uses to hide actions.

| Action | Owner | Signed-in user | Anonymous |
|---|---|---|---|
| Read a public document | Yes | Yes | Yes |
| Read a private or team document | Yes | No | No |
| Edit a public document, see or restore its history | Yes | Yes | No |
| Comment on a document they can read | Yes | Yes | No |
| Rename, change visibility, move to Trash, manage Trash | Yes | No | No |
| Resolve or delete comments | Yes | No | No |

`team` visibility has no members yet, so it currently behaves like `private`.

## Realtime

`realtime-worker/src/index.ts` relays messages between the people in a document. It writes nothing to storage: the database stays the source of truth, and each client saves through `PATCH /api/docs/:id`.

1. The client asks `POST /api/realtime/token` for a token bound to one document. The app checks permissions before signing it. Tokens last 5 minutes, and `lib/realtime.ts` requests a new one on every connection.
2. The client opens a WebSocket to `/doc/:id` and sends the token as a subprotocol.
3. The Worker checks the origin, signature, expiry, and document before creating a room.

Viewer tokens can watch, but nothing they send reaches other people.

**Known limit:** each change sends the whole document and the last write wins, so two people typing at the same moment can overwrite each other. Fixing it needs a CRDT such as Yjs.

Changing a document from public to private doesn't disconnect people who are already in its room. They lose access the next time they connect.

## Deploy

### Web app

Pushing to `main` deploys to Vercel. Set the same variables as `.env.example` in the Vercel project, then apply new migrations:

```bash
pnpm prisma migrate deploy
```

### Realtime Worker

```bash
cd realtime-worker
npm install
npx wrangler deploy
```

The signing secret is stored in Cloudflare and must match `REALTIME_HMAC_SECRET` in Vercel. To set or rotate it, run this and then update Vercel:

```bash
npx wrangler secret put REALTIME_HMAC_SECRET
```

Allowed origins are in `realtime-worker/wrangler.jsonc`. If you change the app's domain, add it there and deploy the Worker. If `NEXT_PUBLIC_REALTIME_URL` changes, redeploy the app, because that value is built into the client.

On the free plan, [Durable Objects stop working for the day at the limit](https://developers.cloudflare.com/durable-objects/platform/pricing/) instead of charging, with 100,000 requests per day. Real-time updates would stop until the reset at 00:00 UTC, while saving through the API keeps working.

## Project layout

```text
app/                    Pages and API routes
  api/docs/             Documents, comments, and revisions
  api/trash/            The owner's Trash
  api/realtime/token/   Issues realtime tokens
  docs/[id]/            Editor page
  p/[id]/               Public read-only page
components/             Editor, comment, and layout components
hooks/useDocumentSocket.ts   Document loading, autosave, realtime, and comments
lib/
  permissions.ts        Who can do what with a document
  realtime.ts           WebSocket client with reconnection
  sanitize.ts           Server-side HTML sanitizing
  validation.ts         Request schemas
prisma/                 Schema and migrations
realtime-worker/        Cloudflare Worker for realtime
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Editing works, but changes don't reach other people | `REALTIME_HMAC_SECRET` differs between Vercel and Cloudflare, or the app's origin isn't in `ALLOWED_ORIGINS` |
| A preview deployment sends you to production at sign-in | `NEXTAUTH_URL` and the GitHub OAuth App only cover the production URL |
| `next build` fails with `_updateWithBuffer` | You are on Node 26. Use Node 22 |
