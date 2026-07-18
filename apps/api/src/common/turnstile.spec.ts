import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	TurnstileGuard,
	turnstileConfigured,
	verifyTurnstile,
} from "./turnstile";

const KEY = "TURNSTILE_SECRET_KEY";

function ctxWith(header?: string): ExecutionContext {
	const req = {
		headers: header ? { "x-turnstile-token": header } : {},
		ip: "1.2.3.4",
	};
	return {
		switchToHttp: () => ({ getRequest: () => req }),
	} as unknown as ExecutionContext;
}

afterEach(() => {
	delete process.env[KEY];
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("verifyTurnstile", () => {
	it("is a no-op (returns true) when no secret is configured", async () => {
		expect(turnstileConfigured()).toBe(false);
		expect(await verifyTurnstile(undefined, "1.2.3.4")).toBe(true);
	});

	it("rejects a missing token when configured", async () => {
		process.env[KEY] = "secret";
		expect(await verifyTurnstile(undefined, "1.2.3.4")).toBe(false);
	});

	it("passes when Cloudflare reports success", async () => {
		process.env[KEY] = "secret";
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ json: async () => ({ success: true }) })),
		);
		expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(true);
	});

	it("fails when Cloudflare reports failure", async () => {
		process.env[KEY] = "secret";
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ json: async () => ({ success: false }) })),
		);
		expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(false);
	});

	it("fails OPEN when Cloudflare is unreachable (outage must not lock users out)", async () => {
		process.env[KEY] = "secret";
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("network down");
			}),
		);
		expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(true);
	});
});

describe("TurnstileGuard", () => {
	it("allows all traffic when unconfigured", async () => {
		const guard = new TurnstileGuard();
		expect(await guard.canActivate(ctxWith())).toBe(true);
	});

	it("throws TURNSTILE_REQUIRED with no token when configured", async () => {
		process.env[KEY] = "secret";
		const guard = new TurnstileGuard();
		await expect(guard.canActivate(ctxWith())).rejects.toThrowError(
			ForbiddenException,
		);
	});

	it("allows a valid token", async () => {
		process.env[KEY] = "secret";
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ json: async () => ({ success: true }) })),
		);
		const guard = new TurnstileGuard();
		expect(await guard.canActivate(ctxWith("good-token"))).toBe(true);
	});

	it("throws TURNSTILE_FAILED for a bad token", async () => {
		process.env[KEY] = "secret";
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ json: async () => ({ success: false }) })),
		);
		const guard = new TurnstileGuard();
		await expect(guard.canActivate(ctxWith("bad-token"))).rejects.toMatchObject(
			{
				response: { code: "TURNSTILE_FAILED" },
			},
		);
	});
});
