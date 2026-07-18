import { type ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * App-wide IP rate limit (§5.9 Layer 1: 100 requests / 60s / IP). Registered as
 * an APP_GUARD so it covers every Nest route by default; the per-user AI and
 * payment limits stack on top via their own `@UseGuards` + `@Throttle`.
 *
 * Keyed by client IP (behind `trust proxy`, `req.ip` is the real X-Forwarded-For
 * client). Auth endpoints are NOT covered here — they are served by Better
 * Auth's Express handler before Nest, and get their own stricter limit from
 * Better Auth's built-in rateLimit (auth.config.ts, §5.9: 5/60s).
 */
@Injectable()
export class GlobalThrottlerGuard extends ThrottlerGuard {
	protected async getTracker(req: Record<string, unknown>): Promise<string> {
		return (req.ip as string) ?? "anon";
	}

	protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
		// Never throttle the suites (deterministic), the health probe, or the
		// websocket upgrade (chat frames are not HTTP requests to meter).
		if (process.env.NODE_ENV === "test") return true;
		const req = context.switchToHttp().getRequest<{ originalUrl?: string }>();
		const url = req?.originalUrl ?? "";
		return url.startsWith("/api/v1/health") || url.startsWith("/socket.io");
	}
}
