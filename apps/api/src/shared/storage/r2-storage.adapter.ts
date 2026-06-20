import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import type { PresignOptions, StoragePort } from "./storage.port";

const DOWNLOAD_EXPIRY_SECONDS = 2 * 60 * 60; // 2h content guardrail (§12.6)
const UPLOAD_EXPIRY_SECONDS = 15 * 60; // 15 min for direct browser uploads

/**
 * Cloudflare R2 adapter (S3-compatible). The private bucket is never public;
 * all access is via short-lived presigned URLs so learners can stream but not
 * permanently download (§5.9 Layer 8 — content protection).
 */
@Injectable()
export class R2StorageAdapter implements StoragePort {
	private readonly client: S3Client;
	private readonly bucket: string;

	constructor() {
		const accountId = process.env.R2_ACCOUNT_ID ?? "";
		this.bucket = process.env.R2_BUCKET_NAME ?? "";
		this.client = new S3Client({
			region: "auto",
			endpoint:
				process.env.R2_ENDPOINT ??
				`https://${accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
				secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
			},
		});
	}

	async putObject(
		key: string,
		body: Buffer,
		contentType: string,
	): Promise<void> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: body,
				ContentType: contentType,
			}),
		);
	}

	async getObject(key: string): Promise<Buffer> {
		const result = await this.client.send(
			new GetObjectCommand({ Bucket: this.bucket, Key: key }),
		);
		if (!result.Body) {
			throw new Error(`R2 object not found: ${key}`);
		}
		const bytes = await result.Body.transformToByteArray();
		return Buffer.from(bytes);
	}

	getSignedDownloadUrl(key: string, options?: PresignOptions): Promise<string> {
		return getSignedUrl(
			this.client,
			new GetObjectCommand({ Bucket: this.bucket, Key: key }),
			{ expiresIn: options?.expiresInSeconds ?? DOWNLOAD_EXPIRY_SECONDS },
		);
	}

	getSignedUploadUrl(
		key: string,
		contentType: string,
		options?: PresignOptions,
	): Promise<string> {
		return getSignedUrl(
			this.client,
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				ContentType: contentType,
			}),
			{ expiresIn: options?.expiresInSeconds ?? UPLOAD_EXPIRY_SECONDS },
		);
	}

	async deleteObject(key: string): Promise<void> {
		await this.client.send(
			new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
		);
	}

	async listKeys(prefix: string): Promise<string[]> {
		const result = await this.client.send(
			new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }),
		);
		return (result.Contents ?? [])
			.map((object) => object.Key)
			.filter((key): key is string => Boolean(key));
	}
}
