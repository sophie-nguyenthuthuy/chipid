FROM node:26.1.0-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS pruner
RUN npm i -g turbo@^2.1.3
COPY . .
RUN turbo prune @chipid/api --docker

FROM base AS deps
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/ .
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @chipid/api exec prisma generate
RUN pnpm --filter @chipid/api build
RUN pnpm --filter @chipid/api deploy --prod /prod/api

FROM node:26.1.0-alpine AS runner
RUN apk add --no-cache tini openssl ca-certificates && \
    addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
WORKDIR /app
COPY --from=builder --chown=app:app /prod/api ./
USER app
ENV NODE_ENV=production
ENV API_PORT=4000
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/healthz || exit 1
