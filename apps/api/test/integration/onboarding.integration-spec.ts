import {
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { OnboardingService } from "../../src/modules/onboarding/onboarding.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

describe("OnboardingService (integration)", () => {
	const prisma = getTestPrisma();
	const storage = new FakeStorageAdapter();
	const service = new OnboardingService(prisma, storage);

	let userId: string;

	beforeEach(async () => {
		userId = (await createUser(prisma, { role: "learner" })).id;
	});

	describe("saveLearner / saveInstructor", () => {
		it("persists learner onboarding answers and stamps onboardedAt", async () => {
			await service.saveLearner(userId, {
				goals: ["career-change"],
				skillLevel: "beginner",
				weeklyHours: "5-10",
			});
			const user = await prisma.user.findUnique({ where: { id: userId } });
			expect(user?.learnerGoals).toEqual(["career-change"]);
			expect(user?.skillLevel).toBe("beginner");
			expect(user?.onboardedAt).not.toBeNull();
		});

		it("persists instructor onboarding answers", async () => {
			await service.saveInstructor(userId, {
				headline: "Senior Engineer",
				bio: "I teach backend systems.",
				expertiseAreas: ["nodejs", "postgres"],
			});
			const user = await prisma.user.findUnique({ where: { id: userId } });
			expect(user?.headline).toBe("Senior Engineer");
			expect(user?.expertiseAreas).toEqual(["nodejs", "postgres"]);
			expect(user?.onboardedAt).not.toBeNull();
		});
	});

	describe("getProfile", () => {
		it("throws when the user doesn't exist", async () => {
			await expect(
				service.getProfile("00000000-0000-0000-0000-000000000000"),
			).rejects.toThrow(NotFoundException);
		});

		it("passes an external (Google) image URL through unsigned", async () => {
			await prisma.user.update({
				where: { id: userId },
				data: { image: "https://accounts.google.com/photo.jpg" },
			});
			const profile = await service.getProfile(userId);
			expect(profile.image).toBe("https://accounts.google.com/photo.jpg");
		});

		it("presigns an uploaded avatar key", async () => {
			await prisma.user.update({
				where: { id: userId },
				data: { avatarUrl: "avatars/some-key.png" },
			});
			const profile = await service.getProfile(userId);
			expect(profile.image).toContain("fake-storage.test/avatars/some-key.png");
		});
	});

	describe("updateProfile", () => {
		it("recomputes the display name from first/other/last names", async () => {
			await service.updateProfile(userId, {
				firstName: "Ada",
				otherNames: "Grace",
				lastName: "Lovelace",
			});
			const user = await prisma.user.findUnique({ where: { id: userId } });
			expect(user?.fullName).toBe("Ada Grace Lovelace");
		});

		it("marks the phone unverified when it changes", async () => {
			await prisma.user.update({
				where: { id: userId },
				data: { phone: "+10000000000", phoneVerified: true },
			});
			await service.updateProfile(userId, { phone: "+19999999999" });
			const user = await prisma.user.findUnique({ where: { id: userId } });
			expect(user?.phoneVerified).toBe(false);
		});

		it("leaves the phone verified when it doesn't actually change", async () => {
			await prisma.user.update({
				where: { id: userId },
				data: { phone: "+10000000000", phoneVerified: true },
			});
			await service.updateProfile(userId, { phone: "+10000000000" });
			const user = await prisma.user.findUnique({ where: { id: userId } });
			expect(user?.phoneVerified).toBe(true);
		});

		it("never wipes instructor fields (headline/bio) when they're omitted", async () => {
			await prisma.user.update({
				where: { id: userId },
				data: { headline: "Existing headline" },
			});
			await service.updateProfile(userId, { firstName: "Updated" });
			const user = await prisma.user.findUnique({ where: { id: userId } });
			expect(user?.headline).toBe("Existing headline");
		});
	});

	describe("avatar upload/delete", () => {
		it("rejects an unsupported image type", async () => {
			await expect(
				service.uploadAvatar(userId, {
					buffer: Buffer.from("data"),
					originalname: "avatar.gif",
					mimetype: "image/gif",
					size: 1000,
				}),
			).rejects.toThrow(UnprocessableEntityException);
		});

		it("rejects an avatar larger than 5MB", async () => {
			await expect(
				service.uploadAvatar(userId, {
					buffer: Buffer.from("data"),
					originalname: "avatar.png",
					mimetype: "image/png",
					size: 6 * 1024 * 1024,
				}),
			).rejects.toThrow(UnprocessableEntityException);
		});

		it("uploads a new avatar and deletes the previous uploaded one", async () => {
			const first = await service.uploadAvatar(userId, {
				buffer: Buffer.from("data"),
				originalname: "avatar1.png",
				mimetype: "image/png",
				size: 1000,
			});
			expect(first.image).toContain("fake-storage.test");
			const beforeSecond = await prisma.user.findUnique({
				where: { id: userId },
			});
			const firstKey = beforeSecond?.avatarUrl as string;

			await service.uploadAvatar(userId, {
				buffer: Buffer.from("data"),
				originalname: "avatar2.png",
				mimetype: "image/png",
				size: 1000,
			});
			await expect(storage.getObject(firstKey)).rejects.toThrow();
		});

		it("deleteAvatar clears the uploaded avatar and falls back to the Better Auth image", async () => {
			await prisma.user.update({
				where: { id: userId },
				data: {
					avatarUrl: "avatars/uploaded.png",
					image: "https://accounts.google.com/fallback.jpg",
				},
			});
			const result = await service.deleteAvatar(userId);
			expect(result.image).toBe("https://accounts.google.com/fallback.jpg");
			const user = await prisma.user.findUnique({ where: { id: userId } });
			expect(user?.avatarUrl).toBeNull();
		});
	});
});
