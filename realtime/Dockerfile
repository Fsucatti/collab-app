# syntax=docker/dockerfile:1

# Base image with corepack (pnpm)
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Install deps (dev+prod)
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build TypeScript -> dist/
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Runtime image (prod only; reuse node_modules for simplicity)
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001
# If you want only production deps, swap the next two COPY lines for a pnpm --prod install.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node","dist/index.js"]
