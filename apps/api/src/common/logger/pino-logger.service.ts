import type { LoggerService } from "@nestjs/common";
import pino from "pino";

/**
 * Structured logging (§15, blueprint "Logging: Pino"). One pino instance backs
 * both faces of logging:
 *
 *  - `logger` — the raw pino instance, shared with pino-http in main.ts so
 *    request logs and app logs land in the same stream with the same shape.
 *  - `PinoLoggerService` — the Nest LoggerService adapter, so every existing
 *    `new Logger(X).log/warn/error(...)` call in the codebase becomes a
 *    structured line without touching a single call site.
 *
 * Pretty-printed in dev (human eyes), raw JSON in production (machine eyes —
 * Railway/log collectors index JSON, not ANSI art). No transport dependency in
 * prod: stdout is the contract.
 */
export const logger = pino({
	level: process.env.LOG_LEVEL ?? "info",
	// pino-pretty is a devDependency-grade concern; guard so a prod image
	// without it never crashes at boot.
	...(process.env.NODE_ENV !== "production" && !process.env.LOG_JSON
		? {
				transport: {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "HH:MM:ss",
						singleLine: true,
					},
				},
			}
		: {}),
	// Never log credentials, even accidentally via object spreads.
	redact: {
		paths: [
			"req.headers.authorization",
			"req.headers.cookie",
			"res.headers['set-cookie']",
		],
		censor: "[redacted]",
	},
});

/** Nest log levels → pino levels. `verbose` maps to trace, the rest 1:1. */
export class PinoLoggerService implements LoggerService {
	log(message: unknown, context?: string): void {
		logger.info({ context }, asText(message));
	}
	error(message: unknown, trace?: string, context?: string): void {
		logger.error({ context, trace }, asText(message));
	}
	warn(message: unknown, context?: string): void {
		logger.warn({ context }, asText(message));
	}
	debug(message: unknown, context?: string): void {
		logger.debug({ context }, asText(message));
	}
	verbose(message: unknown, context?: string): void {
		logger.trace({ context }, asText(message));
	}
}

function asText(message: unknown): string {
	return typeof message === "string" ? message : JSON.stringify(message);
}
