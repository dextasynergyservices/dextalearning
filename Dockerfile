FROM oven/bun:1.3.14-alpine AS api

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages packages

RUN bun install --frozen-lockfile

COPY . .

WORKDIR /app/apps/api

ARG DATABASE_URL="postgresql://dextalearning:secret@postgres:5432/dextalearning"
ENV DATABASE_URL=$DATABASE_URL

RUN bun run prisma:generate
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start:prod"]
