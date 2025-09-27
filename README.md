Collab Notes — README

A lightweight collaborative docs app with real-time editing, comments, revision history, auth, and public sharing. Built with Next.js App Router, Prisma + Postgres, NextAuth (GitHub OAuth) w/ PrismaAdapter, Socket.IO realtime sidecar, and TipTap for rich-text. Styled with Tailwind CSS v4 and theme tokens (light/dark).

✨ Features

Auth: GitHub OAuth via NextAuth + PrismaAdapter (database sessions).

Docs

Create, list, soft-delete (Trash), restore, and duplicate.

Visibility: private | team (UI) → stored as workspace | public.

Public, read-only page at /p/:id.

Real-time editing

Socket.IO sidecar server, rate-limited patch events, sanitized HTML.

Presence (peer cursors + names + colors).

Comments

Anchored to text ranges with context (auto re-locate after edits).

Resolve/unresolve, delete; live fan-out to viewers.

Revisions

Revision per save; modal history + one-click restore.

Editor

TipTap + StarterKit + placeholder.

Cursor + highlights extensions.

Autosave with debounce, “safe apply” on initial load.

Theming

Tailwind v4 + CSS Custom Properties (blue + amber palette).

Dark mode with next-themes and <ThemeProvider />.

🧱 Tech Stack

Web app: Next.js 15 (App Router, app/), TypeScript

Auth: NextAuth (Prisma Adapter, database sessions)

DB: Postgres (e.g., Neon), Prisma ORM

Realtime: Node/Express + Socket.IO (separate service)

Editor: TipTap (ProseMirror)

CSS: Tailwind v4 + CSS variables (light/dark tokens)

📁 Project Structure (key paths)

Features

Auth: GitHub OAuth via NextAuth + PrismaAdapter (database sessions).

Docs

Create, list, soft-delete (Trash), restore, and duplicate.

Visibility: private | team (UI) → stored as workspace | public.

Public, read-only page at /p/:id.

Real-time editing

Socket.IO sidecar server, rate-limited patch events, sanitized HTML.

Presence (peer cursors + names + colors).

Comments

Anchored to text ranges with context (auto re-locate after edits).

Resolve/unresolve, delete; live fan-out to viewers.

Revisions

Revision per save; modal history + one-click restore.

Editor

TipTap + StarterKit + placeholder.

Cursor + highlights extensions.

Autosave with debounce, “safe apply” on initial load.

Theming

Tailwind v4 + CSS Custom Properties (blue + amber palette).

Dark mode with next-themes and <ThemeProvider />.

Features

Auth: GitHub OAuth via NextAuth + PrismaAdapter (database sessions).

Docs

Create, list, soft-delete (Trash), restore, and duplicate.

Visibility: private | team (UI) → stored as workspace | public.

Public, read-only page at /p/:id.

Real-time editing

Socket.IO sidecar server, rate-limited patch events, sanitized HTML.

Presence (peer cursors + names + colors).

Comments

Anchored to text ranges with context (auto re-locate after edits).

Resolve/unresolve, delete; live fan-out to viewers.

Revisions

Revision per save; modal history + one-click restore.

Editor

TipTap + StarterKit + placeholder.

Cursor + highlights extensions.

Autosave with debounce, “safe apply” on initial load.

Theming

Tailwind v4 + CSS Custom Properties (blue + amber palette).

Dark mode with next-themes and <ThemeProvider />.

📁 Project Structure (key paths)

app/
  layout.tsx                # Root layout; Theme & Session providers
  signin/page.tsx           # Custom sign-in page
  docs/page.tsx             # Documents list
  docs/[id]/page.tsx        # Doc editor page
  p/[id]/page.tsx           # Public read-only doc
  trash/page.tsx            # Trash
  api/
    auth/[...nextauth]/route.ts
    docs/route.ts           # GET list, POST create
    docs/[id]/route.ts      # GET/PUT/PATCH/DELETE (content)
    docs/[id]/meta/route.ts # PATCH title/visibility
    docs/[id]/comments/...  # comments CRUD
    docs/[id]/revisions/... # revisions list/restore
    realtime/token/route.ts # HMAC token for Socket.IO server
components/
  Editor.tsx, EditorToolbar.tsx
  extensions/PresenceCursors.ts, CommentsHighlights.ts
  CommentsSidebar.tsx, PresenceBar.tsx, RevisionsPanel.tsx
  Navbar.tsx, ThemeToggle.tsx, AuthButtons.tsx, Toast.tsx
lib/
  api.ts          # fetch helpers
  auth.ts         # NextAuth options (PrismaAdapter)
  identity.ts     # anonymous identity helper for presence
  prisma.ts       # Prisma client
  sanitize.ts     # server-side sanitizeDocHTML, plain text
  validation.ts   # zod schemas (CreateDocBody, PatchDocBody, etc)
  types.ts
prisma/
  schema.prisma
realtime/
  src/index.ts    # Socket.IO server
styles/
  globals.css     # Tailwind v4 + theme tokens
tailwind.config.ts
postcss.config.mjs


🔐 Environment Variables

Create two .env files: one for the Next.js app and one for the realtime server (if hosted separately).

App (.env)
# Database
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="a-strong-random-string"
NEXTAUTH_URL="http://localhost:3000"  # set to your domain in prod

# GitHub OAuth App
GITHUB_ID="xxx"
GITHUB_SECRET="xxx"

# Realtime
NEXT_PUBLIC_REALTIME_URL="http://localhost:3001"  # Socket server URL
REALTIME_HMAC_SECRET="shared-secret-with-realtime"
MAX_DOC_HTML_CHARS="400000"

Realtime server (realtime/.env)

PORT=3001
REALTIME_HMAC_SECRET="shared-secret-with-app"   # MUST MATCH the app
# CORS & preview domains
PROD_APP_ORIGIN="https://your-app.vercel.app"
EXTRA_ORIGINS=""                                # comma-separated
ALLOW_LOCALHOST=true
MAX_DOC_HTML_CHARS="400000"


🧭 Development
pnpm i
pnpm prisma generate
pnpm prisma migrate dev -n "init_app"

If you had existing rows and migration failed because of new NOT NULL columns, run a manual data fix or a one-time script to populate defaults (we did this while evolving the schema).

2) Tailwind v4

We use Tailwind v4 (no config needed unless you want to). Ensure:

styles/globals.css contains:

@import "tailwindcss";

@layer utilities {
  .writing-vertical-rl { writing-mode: vertical-rl; }
}

/* theme tokens and color vars ... */

@import "tailwindcss";

@layer utilities {
  .writing-vertical-rl { writing-mode: vertical-rl; }
}

/* theme tokens and color vars ... */

# App
pnpm dev

# Realtime
cd realtime
pnpm i
pnpm dev

Open http://localhost:3000.

Auth

NextAuth with PrismaAdapter and database session strategy (no JWT for app logic).

Custom sign-in page at /signin with a “Continue with GitHub” button.

Middleware protects /docs, /trash, /settings (redirects to /signin if unauthenticated).

Public endpoints: /api/public/*, /p/*, /api/auth/*, /signin.

Developer checklist

Create a GitHub OAuth App (http://localhost:3000/api/auth/callback/github).

Put GITHUB_ID/GITHUB_SECRET in .env.

Set NEXTAUTH_SECRET.

🔁 Realtime Sidecar

Socket.IO server (realtime/src/index.ts) with:

CORS: prod domain, any *.vercel.app preview, localhost (toggle via env).

HMAC tokens issued by the app (/api/realtime/token), short-lived (5 min).

POST with { docId, intent: "edit" | "view" } verifies ownership for edit.

GET returns anonymous view token for pure watchers.

Rate limiting for doc:patch (stricter for anonymous).

Sanitized, size-bounded HTML.

Client (useDocumentSocket):

Requests token on mount (edit for owner else fallback to view).

Connects io(NEXT_PUBLIC_REALTIME_URL, { auth: { token } }).

Joins doc:<id> on connect and reconnect.

Emits throttled doc:patch and cursor updates.

Applies incoming doc:update, presence, and comment events.

✍️ Editor

TipTap StarterKit + Placeholder.

Two custom extensions:

PresenceCursors: colored selection + caret labels.

CommentsHighlights: comment highlight spans via ProseMirror decorations.

Important: The editor listens to initialHTML changes after mount and applies them without echo loops, so reload shows existing content even if a realtime doc:init event is delayed.


🗂 API (selected)

GET /api/docs?page=&pageSize=&q=&visibility= — paginated list (public + own).

POST /api/docs — create doc (title, content?, visibility?).

GET /api/docs/:id — fetch doc (public or owner access).

PUT /api/docs/:id — upsert (owner only).

PATCH /api/docs/:id — update content (owner only, size + wipe safety).

DELETE /api/docs/:id — soft-delete (Trash).

PATCH /api/docs/:id/meta — update title/visibility (enum mapping).

GET /api/docs/:id/revisions?cursor= — list revisions.

POST /api/docs/:id/revisions/:revId/restore — restore revision.

GET/POST/PATCH/DELETE /api/docs/:id/comments — comments CRUD.

POST /api/realtime/token — HMAC token for Socket.IO (edit/view).

Many endpoints include simple rate limits and no-store headers where relevant.


🧪 Quality & Safety

Server-side sanitization of HTML (sanitizeDocHTML + strict allow-list).

Rate limiting on write APIs and socket patches.

Size bounds: MAX_DOC_HTML_CHARS checked before/after sanitize.

“Safety brake” in PATCH /api/docs/:id to avoid accidental blank overwrite (unless x-allow-empty: true).

Soft delete via deletedAt (immutable until restored).


🎨 Theming

Design tokens via CSS variables in styles/globals.css.

Brand palette: Deep Blue (brand) + Amber (accent).

Utilities: .bg-card, .text-fg, .border-border, etc. (through CSS vars).

Dark mode via next-themes. Root <html class="dark"> toggled automatically; ThemeToggle updates the theme.


🚀 Deployment
App (Vercel)

Add env vars to Vercel project:

DATABASE_URL (pooled)

NEXTAUTH_URL (https://your-domain.vercel.app)

NEXTAUTH_SECRET

GITHUB_ID, GITHUB_SECRET

NEXT_PUBLIC_REALTIME_URL (point to your realtime service)

REALTIME_HMAC_SECRET (same as realtime)

MAX_DOC_HTML_CHARS (optional)

Push to GitHub; Vercel will build and deploy.

Run prisma migrate deploy (Vercel → use build/preview/postinstall script or run against DB manually).

Confirm middleware redirects and the sign-in flow.


Realtime (Railway/Fly/Render/Docker)

Deploy realtime/ as a Node service.

Set:

PORT=3001

REALTIME_HMAC_SECRET (match app)

PROD_APP_ORIGIN=https://your-domain.vercel.app

ALLOW_LOCALHOST=false (in prod)

Expose public URL and set NEXT_PUBLIC_REALTIME_URL in the app.

CORS: The server accepts PROD_APP_ORIGIN, any *.vercel.app (previews), and any EXTRA_ORIGINS you list. Localhost is allowed only when ALLOW_LOCALHOST=true.


🛠 Scripts
pnpm dev                 # Next.js dev
pnpm build && pnpm start # Next.js prod

pnpm prisma generate
pnpm prisma migrate dev -n "change"
pnpm prisma migrate deploy

# Realtime (from /realtime)
pnpm dev
pnpm start

🧩 Common Troubleshooting

Hydration mismatch (dark class): ensure your <html> only gets class="dark" from next-themes (don’t hardcode).

Content “disappears” on reload: Confirm your Editor.tsx has the effect that applies initialHTML after mount without emitting updates.

Public doc shows empty: Ensure /api/docs/:id returns actual content for Visibility.public and that public page doesn’t send doc:patch (read-only).

Foreign key / ownerId errors: When switching to PrismaAdapter, existing docs may have null ownerId. Migrate data to the new User row (one-off fix).

Visibility mapping: UI might use "team", DB uses "workspace". Normalize on POST/PATCH meta.

CORS errors (realtime): Check PROD_APP_ORIGIN, preview domains, and ALLOW_LOCALHOST.


🗺 Roadmap (nice-to-haves)

Team/workspace model beyond single owner (members, invites).

Presence avatars & colors from profile.

Slash commands / formatting toolbar upgrades.

Granular sharing (link with passcode, expiring links).

Server-side novel diff/OT/CRDT (currently “last write wins” with throttle).

Unit tests (API + editor glue), e2e smoke tests (Playwright).