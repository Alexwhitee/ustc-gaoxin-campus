# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# better-sqlite3 无预编译包时需要本地编译；编译工具不进入运行镜像。
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_CAMPUS=jlu
ARG NEXT_PUBLIC_QQ_GROUP_URL=
ENV NEXT_PUBLIC_CAMPUS=$NEXT_PUBLIC_CAMPUS \
    NEXT_PUBLIC_QQ_GROUP_URL=$NEXT_PUBLIC_QQ_GROUP_URL
RUN npm run lint && npm test \
    && DATABASE_PATH=/tmp/build.db npm run build \
    && mkdir -p public

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    TZ=Asia/Shanghai \
    DATABASE_PATH=/app/data/jluai.db \
    BACKUP_DIR=/app/backups
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node backup-db.sh ./backup-db.sh
RUN mkdir -p data backups .next/cache && chown -R node:node data backups .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health', {signal: AbortSignal.timeout(4000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
