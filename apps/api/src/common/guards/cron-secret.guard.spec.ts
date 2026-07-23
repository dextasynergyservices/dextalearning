import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import { CronSecretGuard } from "./cron-secret.guard";

function contextWith(headers: Record<string, string>): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => ({ headers }) }),
	} as unknown as ExecutionContext;
}

describe("CronSecretGuard", () => {
	const guard = new CronSecretGuard();
	const original = process.env.CRON_SECRET;

	afterEach(() => {
		if (original === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = original;
	});

	/** The endpoints behind this guard move money and send mail to everyone. */
	it("fails CLOSED when no secret is configured", () => {
		delete process.env.CRON_SECRET;
		expect(() => guard.canActivate(contextWith({}))).toThrow(
			ForbiddenException,
		);
		// Even presenting a secret can't open it — there's nothing to match.
		expect(() =>
			guard.canActivate(contextWith({ "x-cron-secret": "anything" })),
		).toThrow(ForbiddenException);
	});

	it("allows a request carrying the exact secret", () => {
		process.env.CRON_SECRET = "s3cret-value";
		expect(
			guard.canActivate(contextWith({ "x-cron-secret": "s3cret-value" })),
		).toBe(true);
	});

	it("refuses a wrong, absent, or partial secret", () => {
		process.env.CRON_SECRET = "s3cret-value";
		const cases: Record<string, string>[] = [
			{},
			{ "x-cron-secret": "" },
			{ "x-cron-secret": "wrong" },
			// A prefix must not pass — length is checked before comparing.
			{ "x-cron-secret": "s3cret" },
		];
		for (const headers of cases) {
			expect(() => guard.canActivate(contextWith(headers))).toThrow(
				ForbiddenException,
			);
		}
	});
});
