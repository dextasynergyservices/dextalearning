# DextaLearning

Behavior-driven learning operating system built as a Bun + Turborepo monorepo.

## Apps

- `apps/web` - React 19, Vite, Tailwind CSS v4, shadcn/ui
- `apps/api` - NestJS 11, Prisma, PostgreSQL, Redis, Meilisearch

## Local Development

Install dependencies:

```sh
bun install
```

Create local env files:

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Start local infrastructure in one terminal:

```sh
bun run dev:infra
```

Start both app servers in another terminal:

```sh
bun run dev
```

This split is intentional: Docker services are managed separately, while `bun run dev` only starts the web and API dev servers.

`bun run dev:infra` starts:

- PostgreSQL with pgvector on `localhost:5432`
- Redis on `localhost:6379`
- Meilisearch on `localhost:7700`

`bun run dev` starts:

- API on `http://localhost:3000`
- Web on `http://localhost:5173`

Useful URLs:

- API health: `http://localhost:3000/api/v1/health`
- API docs: `http://localhost:3000/api/docs`
- Web app: `http://localhost:5173`

## Docker

Start local infrastructure:

```sh
bun run dev:infra
```

Run the API in Docker:

```sh
bun run docker:api
```

Stop Docker services:

```sh
bun run docker:down
```

## Prisma

From `apps/api`:

```sh
bun run prisma:generate
bun run prisma:migrate
```

The local Docker database enables `pgvector` automatically via `docker/postgres/init/001-enable-pgvector.sql`.

## Quality Checks

Run Biome lint checks across apps:

```sh
bun run lint
```

Apply safe Biome fixes across apps:

```sh
bun run lint:fix
```

Format app files with Biome:

```sh
bun run format
```

Run TypeScript checks for both web and API:

```sh
bun run typecheck
```
