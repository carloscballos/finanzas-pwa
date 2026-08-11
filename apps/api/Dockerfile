# Build context is the monorepo root (needed for npm workspaces hoisting).
# Railway: Builder = Dockerfile, Dockerfile Path = apps/api/Dockerfile, Root Directory = (blank/repo root).

FROM node:24-alpine AS builder
WORKDIR /app

# prisma.config.ts valida DATABASE_URL al cargar, incluso para `prisma
# generate` (que no necesita conexión real) — con esto Railway pasa el valor
# real durante el build; local se puede pasar cualquier valor con formato
# válido vía --build-arg.
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

COPY package.json package-lock.json ./
COPY apps/api apps/api
RUN npm install

RUN npm run build --workspace=api

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
