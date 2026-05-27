# ── 阶段 1：安装依赖 ──
FROM node:22-alpine AS deps

# pnpm 需要
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 先复制 lock 文件，利用 Docker 缓存层
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY packages/llm-client/package.json packages/llm-client/
COPY packages/database/package.json packages/database/
COPY packages/engines/package.json packages/engines/
COPY packages/pipeline/package.json packages/pipeline/
COPY packages/companion/package.json packages/companion/

RUN pnpm install --frozen-lockfile --prod

# ── 阶段 2：构建 ──
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/ apps/server/
COPY packages/ packages/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @narrative-os/server exec tsc --noEmit || true

# ── 阶段 3：运行时 ──
FROM node:22-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

# 非 root 用户运行
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/apps/server ./apps/server
COPY --from=builder /app/packages ./packages

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=20s \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "apps/server/src/index.ts"]
