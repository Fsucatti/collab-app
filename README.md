# Collab Notes

A collaborative document editor with real-time editing, comments, revision history, GitHub sign-in and public sharing.

**Built with:** Next.js, TipTap, Tailwind CSS, Prisma, Postgres and Cloudflare Workers.

## How to use it

1. Sign in with GitHub.
2. Create a document and start writing. Your changes save automatically.
3. Set it to public and share the link, so others can read it or work on it with you.
4. Select text to leave a comment, or open **History** to go back to an earlier version.

## Run it locally

You need Node 22 and pnpm. `next build` fails on Node 26.

1. Create the app settings and fill them in:

   ```bash
   cp .env.example .env
   ```

2. Start a database, or point `DATABASE_URL` at one of your own:

   ```bash
   docker compose up -d
   ```

3. Install dependencies and set up the database:

   ```bash
   pnpm install
   pnpm prisma migrate deploy
   ```

4. Start the realtime service in a second terminal:

   ```bash
   cd realtime-worker
   cp .dev.vars.example .dev.vars
   npm install
   npm run dev
   ```

5. Start the app and open <http://localhost:3000>:

   ```bash
   pnpm dev
   ```

GitHub sign-in needs your own [OAuth App](https://github.com/settings/developers), with `http://localhost:3000/api/auth/callback/github` as its callback URL.
