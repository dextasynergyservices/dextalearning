/**
 * Storage abstraction (hexagonal port — blueprint §6.4). The domain depends on
 * this interface; the concrete Cloudflare R2 adapter is injected via the
 * `STORAGE_PORT` token, so the provider can be swapped without touching callers.
 */
export const STORAGE_PORT = Symbol("STORAGE_PORT");

export interface PresignOptions {
	/** Link lifetime in seconds. Defaults to the 2-hour content guardrail (§12.6). */
	expiresInSeconds?: number;
}

export interface StoragePort {
	/** Upload bytes to a key (used by encoding workers writing derived assets). */
	putObject(key: string, body: Buffer, contentType: string): Promise<void>;
	/** Fetch an object's bytes (used by workers reading the source upload). */
	getObject(key: string): Promise<Buffer>;
	/** Presigned GET URL for protected playback (default 2h expiry). */
	getSignedDownloadUrl(key: string, options?: PresignOptions): Promise<string>;
	/** Presigned PUT URL for direct browser → R2 upload (default 15 min). */
	getSignedUploadUrl(
		key: string,
		contentType: string,
		options?: PresignOptions,
	): Promise<string>;
	/** Remove an object (cleanup on lesson/media deletion). */
	deleteObject(key: string): Promise<void>;
	/** List object keys under a prefix (e.g. a lesson's rasterised PDF pages). */
	listKeys(prefix: string): Promise<string[]>;
}
