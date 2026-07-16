import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { EarningsService } from "../../src/modules/payments/earnings.service";
import { PaymentGatewayRegistry } from "../../src/modules/payments/payment-gateway.registry";
import { PayoutAccountService } from "../../src/modules/payments/payout-account.service";
import type { PlatformSettingsService } from "../../src/shared/settings/platform-settings.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";

describe("PayoutAccount + Earnings (integration)", () => {
	const prisma = getTestPrisma();
	// Payout-account work never consults the enabled-providers switch.
	const gateways = new PaymentGatewayRegistry({
		enabledPaymentProviders: async () => ["paystack", "stripe"],
	} as unknown as PlatformSettingsService);
	const payoutAccount = new PayoutAccountService(prisma, gateways);
	const earnings = new EarningsService(prisma);

	let instructorId: string;
	beforeEach(async () => {
		const i = await createUser(prisma, { role: "instructor" });
		instructorId = i.id;
	});

	it("verifies + adds a Paystack account; first one is the default", async () => {
		const view = await payoutAccount.addPaystackAccount(instructorId, {
			bankCode: "001",
			accountNumber: "0123456789",
		});
		expect(view.provider).toBe("paystack");
		expect(view.verified).toBe(true);
		expect(view.isDefault).toBe(true);
		expect(view.accountName).toBe("Test Account Holder");
		expect(view.last4).toBe("6789");

		const list = await payoutAccount.listAccounts(instructorId);
		expect(list).toHaveLength(1);
		const def = await payoutAccount.getDefaultAccount(instructorId);
		expect(def?.id).toBe(view.id);
	});

	it("supports multiple accounts and switching the default", async () => {
		const a = await payoutAccount.addPaystackAccount(instructorId, {
			bankCode: "001",
			accountNumber: "0123456789",
		});
		const b = await payoutAccount.addPaystackAccount(instructorId, {
			bankCode: "002",
			accountNumber: "1112223334",
		});
		expect(a.isDefault).toBe(true);
		expect(b.isDefault).toBe(false); // second is NOT auto-default

		const afterSwitch = await payoutAccount.setDefault(instructorId, b.id);
		expect(afterSwitch.find((x) => x.id === b.id)?.isDefault).toBe(true);
		expect(afterSwitch.find((x) => x.id === a.id)?.isDefault).toBe(false);
		expect((await payoutAccount.getDefaultAccount(instructorId))?.id).toBe(
			b.id,
		);

		// Deleting the default promotes the remaining verified account.
		const afterDelete = await payoutAccount.deleteAccount(instructorId, b.id);
		expect(afterDelete).toHaveLength(1);
		expect(afterDelete[0].id).toBe(a.id);
		expect(afterDelete[0].isDefault).toBe(true);
	});

	it("rejects an unresolvable account number", async () => {
		await expect(
			payoutAccount.addPaystackAccount(instructorId, {
				bankCode: "001",
				accountNumber: "123", // not 10 digits → Fake returns null
			}),
		).rejects.toThrow(BadRequestException);
		expect(await payoutAccount.listAccounts(instructorId)).toHaveLength(0);
	});

	it("summarises earnings by payout status", async () => {
		const order = await prisma.order.create({
			data: { instructorId, entityTitle: "Paid Course", currency: "NGN" },
			select: { id: true },
		});
		await prisma.instructorPayout.createMany({
			data: [
				{
					orderId: order.id,
					instructorId,
					amount: 90,
					currency: "NGN",
					status: "processed",
				},
				{
					orderId: order.id,
					instructorId,
					amount: 45,
					currency: "NGN",
					status: "pending",
				},
			],
		});

		const summary = await earnings.summary(instructorId);
		expect(summary.lifetimeProcessed).toBe(90);
		expect(summary.pending).toBe(45);
		expect(summary.processedCount).toBe(1);

		const history = await earnings.history(instructorId);
		expect(history).toHaveLength(2);
		expect(history[0].entityTitle).toBe("Paid Course");
	});
});
