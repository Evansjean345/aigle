#
#
# Dockerfile multi-stage pour aigle_send_api (AdonisJS v6) — base Alpine
#
# Stratégie : install prod faite dans le stage 2 (pas de COPY de node_modules).
# Le `node ace build` génère build/ qui contient déjà package.json + package-lock.json,
# donc le `npm ci --omit=dev` du stage 2 utilise ces fichiers — install propre,
# pas de devDeps qui traînent.

# =============================================================================
# Stage 1 — builder : install + compile
# =============================================================================
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN node ace build --ignore-ts-errors

# =============================================================================
# Stage 2 — production : install prod + runtime minimal
# =============================================================================
FROM node:24-alpine AS production

ARG USER_NAME="aiglesend"
ARG USER_ID=1001

# dumb-init : relaie correctement les signaux (SIGTERM → graceful shutdown Adonis)
# (~150 Ko — léger mais critique pour le bon arrêt en prod)
RUN apk add --no-cache dumb-init

# Sécurité : utilisateur non-root
RUN addgroup --system --gid ${USER_ID} ${USER_NAME} \
    && adduser --system --uid ${USER_ID} -G ${USER_NAME} ${USER_NAME}

RUN mkdir -p /app/logs \
    && chown -R ${USER_NAME}:${USER_NAME} /app

WORKDIR /app

# Copie le build Adonis (inclut package.json + package-lock.json + JS compilé)
COPY --from=builder --chown=${USER_NAME}:${USER_NAME} /app/build .

# Install des dépendances production uniquement
# (npm tourne en root ici → re-chown du node_modules pour adonisjs après)
#
# Suppression manuelle des devDeps tirées par des peerOptional :
# - @adonisjs/application déclare peerOptional @adonisjs/assembler
#   → tire typescript (23Mo) + ts-morph (12Mo) + @ast-grep/napi (15Mo)
# - @adonisjs/auth déclare peerOptional @japa/browser-client
#   → tire playwright + playwright-core (11Mo)
# Aucun de ces paquets n'est importé en runtime prod (utilisés par node ace,
# tests, eslint). Gain : ~60 Mo.
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf \
       node_modules/typescript \
       node_modules/ts-morph \
       node_modules/@ts-morph \
       node_modules/@ast-grep \
       node_modules/playwright \
       node_modules/playwright-core \
       node_modules/@adonisjs/assembler \
       node_modules/@japa \
       node_modules/@poppinss/ts-exec \
    && chown -R ${USER_NAME}:${USER_NAME} /app/node_modules

USER ${USER_NAME}

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    NODE_OPTIONS="--enable-source-maps"

EXPOSE 3333

# Healthcheck : ping /health (endpoint exposé par HealthController)
# - start-period 30s : Adonis a besoin de temps pour DB + Redis init
# - retries 3 : tolère 90s d'instabilité avant marquer unhealthy
# - On utilise node http natif plutôt que curl (économise un paquet apk)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "bin/server.js"]
