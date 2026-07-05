import {
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { BlogService } from "../../src/modules/content/blog.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "admin", name: "Admin User" };
}

describe("BlogService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new BlogService(prisma, new FakeStorageAdapter());

	let adminId: string;

	beforeEach(async () => {
		adminId = (await createUser(prisma, { role: "admin" })).id;
	});

	it("creates a draft post with the author's name and a generated slug", async () => {
		const post = await service.createPost(asAuthenticatedUser(adminId), {
			title: "How We Built This",
		});
		expect(post.status).toBe("draft");
		expect(post.authorName).toBe("Admin User");
		expect(post.slug).toBe("how-we-built-this");
	});

	it("dedupes the slug when two posts share a title", async () => {
		const a = await service.createPost(asAuthenticatedUser(adminId), {
			title: "Same Title",
		});
		const b = await service.createPost(asAuthenticatedUser(adminId), {
			title: "Same Title",
		});
		expect(a.slug).not.toBe(b.slug);
	});

	describe("updatePost", () => {
		it("recomputes readMinutes only when bodyHtml is provided", async () => {
			const post = await service.createPost(asAuthenticatedUser(adminId), {
				title: "Read time",
			});
			const withoutBody = await service.updatePost(post.id, {
				excerpt: "Just an excerpt",
			});
			expect(withoutBody.readMinutes).toBeNull();

			const longBody = `<p>${"word ".repeat(400)}</p>`; // 400 words -> 2 min
			const withBody = await service.updatePost(post.id, {
				bodyHtml: longBody,
			});
			expect(withBody.readMinutes).toBe(2);
		});

		it("throws for a non-existent post", async () => {
			await expect(
				service.updatePost("00000000-0000-0000-0000-000000000000", {
					title: "Nope",
				}),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("uploadCover", () => {
		it("rejects an unsupported cover type", async () => {
			const post = await service.createPost(asAuthenticatedUser(adminId), {
				title: "Cover test",
			});
			await expect(
				service.uploadCover(post.id, {
					buffer: Buffer.from("data"),
					originalname: "cover.gif",
					mimetype: "image/gif",
					size: 1000,
				}),
			).rejects.toThrow(UnprocessableEntityException);
		});

		it("uploads a cover and replaces the previous one", async () => {
			const post = await service.createPost(asAuthenticatedUser(adminId), {
				title: "Cover test 2",
			});
			const first = await service.uploadCover(post.id, {
				buffer: Buffer.from("data"),
				originalname: "cover1.png",
				mimetype: "image/png",
				size: 1000,
			});
			await service.uploadCover(post.id, {
				buffer: Buffer.from("data"),
				originalname: "cover2.png",
				mimetype: "image/png",
				size: 1000,
			});
			const updated = await prisma.blogPost.findUnique({
				where: { id: post.id },
			});
			expect(updated?.coverKey).not.toBe(first.coverKey);
		});
	});

	describe("publishPost", () => {
		it("rejects publishing an empty post", async () => {
			const post = await service.createPost(asAuthenticatedUser(adminId), {
				title: "Empty post",
			});
			await expect(service.publishPost(post.id)).rejects.toThrow(
				"Write the post body before publishing.",
			);
		});

		it("publishes once the body is set, and keeps publishedAt stable on republish", async () => {
			const post = await service.createPost(asAuthenticatedUser(adminId), {
				title: "Ready post",
			});
			await service.updatePost(post.id, { bodyHtml: "<p>Content</p>" });
			const first = await service.publishPost(post.id);
			expect(first.status).toBe("published");
			expect(first.publishedAt).not.toBeNull();

			const second = await service.publishPost(post.id);
			expect(second.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
		});
	});

	describe("deletePost", () => {
		it("removes the post", async () => {
			const post = await service.createPost(asAuthenticatedUser(adminId), {
				title: "To delete",
			});
			const result = await service.deletePost(post.id);
			expect(result).toEqual({ deleted: true });
			expect(
				await prisma.blogPost.findUnique({ where: { id: post.id } }),
			).toBeNull();
		});
	});
});
