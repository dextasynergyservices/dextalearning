import { type ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Per-USER rate limiter for the expensive AI routes (§5 blueprint) — keys the
 * throttle window on the authenticated user id (falling back to IP), so limits
 * follow the account, not the network. Skipped under NODE_ENV=test so e2e/
 * integration suites aren't rate-limited.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
	protected async getTracker(req: Record<string, unknown>): Promise<string> {
		const user = req.user as { id?: string } | undefined;
		return user?.id ?? (req.ip as string) ?? "anon";
	}

	protected async shouldSkip(_context: ExecutionContext): Promise<boolean> {
		return process.env.NODE_ENV === "test";
	}
}
