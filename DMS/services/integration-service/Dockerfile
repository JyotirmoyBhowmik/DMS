# Stage 1: Prune the workspace
FROM node:18-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=@dms/integration-service --docker

# Stage 2: Install dependencies & Build
FROM node:18-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
RUN pnpm build --filter=@dms/integration-service
RUN pnpm prune --prod

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/services/integration-service/package.json ./package.json
COPY --from=builder /app/services/integration-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/integration-service/node_modules ./services/integration-service/node_modules
COPY --from=builder /app/packages ./packages

USER nodejs

# Note: Healthcheck removed since this is a worker service, not an HTTP server
# Or could expose a basic healthcheck route if required in the future

CMD ["node", "dist/services/integration-service/src/index.js"]
