FROM oven/bun:1.3.14-alpine AS api

WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages packages

# Resilient install: persist bun's download cache across retries, cap network
# concurrency (avoids "Fail extracting tarball" under parallel load on large
# binaries like @tensorflow/tfjs and sharp), and retry up to 3x on transient
# registry/IO blips.
RUN --mount=type=cache,target=/root/.bun/install/cache \
	for attempt in 1 2 3; do \
		bun install --frozen-lockfile --network-concurrency=16 \
			--cache-dir=/root/.bun/install/cache && break; \
		if [ "$attempt" = "3" ]; then \
			echo "bun install failed after 3 attempts" >&2; \
			exit 1; \
		fi; \
		echo "bun install attempt $attempt failed; retrying in 5s..."; \
		sleep 5; \
	done

COPY . .

WORKDIR /app/apps/api

ARG DATABASE_URL="postgresql://dextalearning:secret@postgres:5432/dextalearning"
ENV DATABASE_URL=$DATABASE_URL

RUN bun run prisma:generate
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start:prod"]
