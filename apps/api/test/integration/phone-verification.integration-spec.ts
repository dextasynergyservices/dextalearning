import { beforeEach, describe, expect, it } from "vitest";
import { PhoneVerificationService } from "../../src/modules/phone-verification/phone-verification.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";
import { FakeNotificationAdapter } from "./support/fakes/fake-notification.adapter";

const PHONE = "+2348001234567";

/** Pull the 6-digit code out of the delivered message (as a learner would read it). */
function codeFrom(message: string): string {
	const match = message.match(/\b(\d{6})\b/);
	if (!match) throw new Error(`no code in message: ${message}`);
	return match[1];
}

describe("PhoneVerificationService (integration)", () => {
	const prisma = getTestPrisma();
	const port = new FakeNotificationAdapter();
	const service = new PhoneVerificationService(prisma, port);

	let userId: string;

	beforeEach(async () => {
		port.reset();
		userId = (await createUser(prisma, { role: "learner" })).id;
		await prisma.user.update({ where: { id: userId }, data: { phone: PHONE } });
	});

	it("sends a WhatsApp code by default; the right code verifies the phone and clears the challenge", async () => {
		const res = await service.sendCode(userId);
		expect(res).toMatchObject({ status: "sent", channel: "whatsapp" });
		expect(port.whatsapps).toHaveLength(1);
		expect(port.whatsapps[0].phone).toBe(PHONE);

		const code = codeFrom(port.whatsapps[0].message);
		const verified = await service.verifyCode(userId, code);
		expect(verified).toEqual({ status: "verified" });

		const user = await prisma.user.findUnique({ where: { id: userId } });
		expect(user?.phoneVerified).toBe(true);
		// Challenge consumed.
		expect(
			await prisma.phoneVerification.findUnique({ where: { userId } }),
		).toBeNull();
	});

	it("delivers over SMS when that channel is chosen", async () => {
		const res = await service.sendCode(userId, "sms");
		expect(res).toMatchObject({ status: "sent", channel: "sms" });
		expect(port.smses).toHaveLength(1);
		expect(port.whatsapps).toHaveLength(0);
	});

	it("rejects an incorrect code, counts the attempt, and leaves the phone unverified", async () => {
		await service.sendCode(userId);
		const code = codeFrom(port.whatsapps[0].message);
		const wrong = (Number(code) === 0 ? 1 : Number(code) - 1)
			.toString()
			.padStart(6, "0");

		await expect(service.verifyCode(userId, wrong)).rejects.toMatchObject({
			response: { code: "INVALID_CODE" },
		});
		const user = await prisma.user.findUnique({ where: { id: userId } });
		expect(user?.phoneVerified).toBe(false);
		const challenge = await prisma.phoneVerification.findUnique({
			where: { userId },
		});
		expect(challenge?.attempts).toBe(1);
	});

	it("requires a phone number before sending", async () => {
		await prisma.user.update({ where: { id: userId }, data: { phone: null } });
		await expect(service.sendCode(userId)).rejects.toMatchObject({
			response: { code: "PHONE_REQUIRED" },
		});
	});

	it("is a no-op once the phone is already verified", async () => {
		await prisma.user.update({
			where: { id: userId },
			data: { phoneVerified: true },
		});
		expect(await service.sendCode(userId)).toEqual({
			status: "already_verified",
		});
		expect(port.whatsapps).toHaveLength(0);
		expect(await service.verifyCode(userId, "000000")).toEqual({
			status: "verified",
		});
	});

	it("enforces a resend cooldown while a fresh code is still valid", async () => {
		await service.sendCode(userId);
		await expect(service.sendCode(userId)).rejects.toMatchObject({
			status: 429,
			response: { code: "RESEND_COOLDOWN" },
		});
		// Only the first code was actually sent.
		expect(port.whatsapps).toHaveLength(1);
	});

	it("rejects an expired code and clears it", async () => {
		await service.sendCode(userId);
		const code = codeFrom(port.whatsapps[0].message);
		await prisma.phoneVerification.update({
			where: { userId },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});
		await expect(service.verifyCode(userId, code)).rejects.toMatchObject({
			response: { code: "CODE_EXPIRED" },
		});
		expect(
			await prisma.phoneVerification.findUnique({ where: { userId } }),
		).toBeNull();
	});
});
