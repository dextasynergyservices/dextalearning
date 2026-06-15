import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface ResponseEnvelope<T> {
	success: true;
	data: T;
	meta?: Record<string, unknown>;
}

/**
 * Wraps every successful handler result in the standard success envelope
 * documented in blueprint §5.10:
 *   { success: true, data: { ... }, meta?: { page, pageSize, total } }
 *
 * A handler that returns `{ data, meta }` is treated as already carrying
 * pagination metadata and is spread into the envelope; anything else is
 * wrapped wholesale as `data`.
 */
@Injectable()
export class ResponseInterceptor<T>
	implements NestInterceptor<T, ResponseEnvelope<unknown>>
{
	intercept(
		_context: ExecutionContext,
		next: CallHandler<T>,
	): Observable<ResponseEnvelope<unknown>> {
		return next.handle().pipe(
			map((payload) => {
				if (
					payload !== null &&
					typeof payload === "object" &&
					"data" in payload &&
					"meta" in payload
				) {
					const { data, meta } = payload as {
						data: unknown;
						meta: Record<string, unknown>;
					};
					return { success: true, data, meta };
				}
				return { success: true, data: payload };
			}),
		);
	}
}
