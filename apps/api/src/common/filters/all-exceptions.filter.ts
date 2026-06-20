import { randomUUID } from "node:crypto";
import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorEnvelope {
	success: false;
	error: {
		code: string;
		message: string;
		details?: unknown;
		requestId: string;
	};
}

/**
 * Catches every unhandled exception and serialises it into the standard error
 * envelope documented in blueprint §5.10:
 *   { success: false, error: { code, message, details?, requestId } }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const requestId = `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

		let status = HttpStatus.INTERNAL_SERVER_ERROR;
		let message = "An unexpected error occurred";
		let details: unknown;
		let customCode: string | undefined;

		if (exception instanceof HttpException) {
			status = exception.getStatus();
			const res = exception.getResponse();
			if (typeof res === "string") {
				message = res;
			} else if (res && typeof res === "object") {
				const body = res as Record<string, unknown>;
				if (Array.isArray(body.message)) {
					details = body.message;
					message = body.message.join(", ");
				} else if (typeof body.message === "string") {
					message = body.message;
				}
				// A handler may supply a stable machine code + structured details
				// (e.g. MEDIA_DURATION_EXCEEDED — §13).
				if (typeof body.code === "string") customCode = body.code;
				if (body.details !== undefined) details = body.details;
			}
		}

		const code =
			customCode ??
			(typeof HttpStatus[status] === "string"
				? (HttpStatus[status] as string)
				: "ERROR");

		if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
			this.logger.error(
				`[${requestId}] ${request.method} ${request.originalUrl} -> ${status}`,
				exception instanceof Error ? exception.stack : String(exception),
			);
		}

		const envelope: ErrorEnvelope = {
			success: false,
			error: {
				code,
				message,
				...(details === undefined ? {} : { details }),
				requestId,
			},
		};

		response.status(status).json(envelope);
	}
}
