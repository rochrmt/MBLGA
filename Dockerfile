# ============================================================
#  AGEO — Image Docker tout-en-un (backend + frontend compilé)
#  La base MySQL est un conteneur séparé (docker-compose)
# ============================================================

# ── Étape 1 : compiler le frontend React ───────────────────────────────────
FROM node:20-alpine AS client-build
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Étape 2 : installer les dépendances du backend (production uniquement) ─
FROM node:20-alpine AS server-deps
WORKDIR /build/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ── Étape 3 : image finale ─────────────────────────────────────────────────
FROM node:20-alpine
ENV NODE_ENV=production

WORKDIR /app/server

# Dépendances backend installées
COPY --from=server-deps /build/server/node_modules ./node_modules

# Code backend
COPY server/ ./

# Frontend compilé (le serveur Express le sert depuis ../client/dist)
COPY --from=client-build /build/client/dist /app/client/dist

EXPOSE 3001

CMD ["node", "index.js"]
