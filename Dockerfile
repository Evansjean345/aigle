# syntax=docker/dockerfile:1.7
#
# Dockerfile multi-stage pour aigle_send_api (AdonisJS v6)
#
# Stages :
#   1. builder    — compile TypeScript -> JavaScript (build/ généré par `node ace build`)
#   2. deps       — installe uniquement les dépendances de production
#   3. production — image runtime minimale, user non-root, healthcheck
#
# Référence : docs/plans/2026-05-06-vps-deployment-design.md (section 2.1)

# =============================================================================
# Stage 1 — builder : compilation
# =============================================================================
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node ace build --ignore-ts-errors

# =============================================================================
# Stage 2 — deps : dépendances production uniquement
# =============================================================================
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# =============================================================================
# Stage 3 — production : image runtime
# =============================================================================
FROM node:22-slim AS production

ARG USER_NAME="aiglesend"
ARG USER_ID=1001

# dumb-init : relaie correctement les signaux (SIGTERM -> graceful shutdown)
# tini est aussi utilisable, dumb-init choisi pour son comportement plus prévisible.
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/*

# User non-root (Debian : useradd, pas adduser -D qui est Alpine)
RUN groupadd -r -g ${USER_ID} ${USER_NAME} \
 && useradd -r -u ${USER_ID} -g ${USER_NAME} -m -s /bin/bash ${USER_NAME}

WORKDIR /app

COPY --from=deps    --chown=${USER_NAME}:${USER_NAME} /app/node_modules ./node_modules
COPY --from=builder --chown=${USER_NAME}:${USER_NAME} /app/build .

USER ${USER_NAME}

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    NODE_OPTIONS="--enable-source-maps"

EXPOSE 3333

# Healthcheck : ping /health (endpoint exposé par HealthController)
# - start-period 30s : Adonis a besoin de temps pour DB + Redis init
# - retries 3 : tolère 90s d'instabilité avant marquer unhealthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "bin/server.js"]
