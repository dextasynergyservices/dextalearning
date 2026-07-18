/**
 * Runtime topology flags (infra budget — see the free-tier notes).
 *
 * The app runs as a SINGLE instance on the free serverless tier, so per-request
 * state (rate-limit counters, Better Auth sessions, Socket.io fan-out) is
 * correct in memory and costs ZERO Redis commands. Putting any of those on the
 * hot path in Redis would blow the 500k-commands/month cap in days.
 *
 * `REDIS_DISTRIBUTED=true` (only meaningful once the app is scaled to multiple
 * instances) opts those hot paths back onto Redis so the instances share state.
 * It is deliberately SEPARATE from `REDIS_URL`: `REDIS_URL` alone enables only
 * the low-frequency TTL caches (leaderboard, AI responses, settings) via
 * `CachePort` — those are the intended, budget-safe use of the free Redis tier.
 */
export function isDistributedRuntime(): boolean {
	return (
		process.env.REDIS_DISTRIBUTED === "true" && Boolean(process.env.REDIS_URL)
	);
}

/**
 * True when a DURABLE background queue (BullMQ over Redis) should back the media
 * + payment workers. BullMQ workers block-poll Redis continuously, so they must
 * NOT run on the metered cache Redis — this is gated on a DEDICATED persistent
 * `QUEUE_REDIS_URL` (or a full multi-instance deploy), NOT on `REDIS_URL`. When
 * false (the free tier), the queue runs in-process (InlineQueueAdapter): zero
 * Redis, jobs execute in the same instance. Provisioning a persistent Redis and
 * setting `QUEUE_REDIS_URL` flips to BullMQ with no code change — see the queue
 * port. Budget rationale in the free-tier infra notes.
 */
export function isQueueDurable(): boolean {
	return Boolean(process.env.QUEUE_REDIS_URL) || isDistributedRuntime();
}
