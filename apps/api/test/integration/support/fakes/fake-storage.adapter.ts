import type {
	PresignOptions,
	StoragePort,
} from "../../../../src/shared/storage/storage.port";

/** In-memory `StoragePort` for integration tests — no real R2 calls. */
export class FakeStorageAdapter implements StoragePort {
	private readonly objects = new Map<
		string,
		{ body: Buffer; contentType: string }
	>();

	async putObject(
		key: string,
		body: Buffer,
		contentType: string,
	): Promise<void> {
		this.objects.set(key, { body, contentType });
	}

	async getObject(key: string): Promise<Buffer> {
		const object = this.objects.get(key);
		if (!object) throw new Error(`FakeStorageAdapter: no object at "${key}"`);
		return object.body;
	}

	async getSignedDownloadUrl(
		key: string,
		options?: PresignOptions,
	): Promise<string> {
		const expiresIn = options?.expiresInSeconds ?? 7_200;
		return `https://fake-storage.test/${key}?expiresIn=${expiresIn}`;
	}

	async getSignedUploadUrl(
		key: string,
		contentType: string,
		options?: PresignOptions,
	): Promise<string> {
		const expiresIn = options?.expiresInSeconds ?? 900;
		return `https://fake-storage.test/${key}?upload=1&contentType=${encodeURIComponent(contentType)}&expiresIn=${expiresIn}`;
	}

	async deleteObject(key: string): Promise<void> {
		this.objects.delete(key);
	}

	async listKeys(prefix: string): Promise<string[]> {
		return [...this.objects.keys()].filter((key) => key.startsWith(prefix));
	}
}
