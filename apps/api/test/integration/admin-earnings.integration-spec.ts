import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { OrderStatus } from "../../generated/prisma/client";
import { AdminEarningsService } from "../../src/modules/payments/admin-earnings.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";

describe("AdminEarningsService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new AdminEarningsService(prisma);

	let learnerId: string;
	let instructorId: string;

	beforeEach(async () => {
		learnerId = (await createUser(prisma, { role: "learner" })).id;
		instructorId = (await createUser(prisma, { role: "instructor" })).id;
	});

	/**
	 * A settled order with the §2 shape: price 1000, 5% fee = 50, remainder 950,
	 * earn-back base 100% of remainder would leave nothing guaranteed — so use a
	 * 20% earn-back to keep the arithmetic readable:
	 *   P=1000, F=50, R=950, B=190 (20% of R), N=760, instructor=684, platform=76
	 * platformAmount is the platform's *total* take: F + 10% of N = 50 + 76 = 126.
	 */
	function order(overrides: {
		status: OrderStatus;
		entityTitle: string;
		entityId?: string;
		amount?: number;
	}) {
		return prisma.order.create({
			data: {
				userId: learnerId,
				instructorId,
				entityType: "course",
				entityId: overrides.entityId ?? randomUUID(),
				entityTitle: overrides.entityTitle,
				amount: overrides.amount ?? 1000,
				currency: "NGN",
				status: overrides.status,
				platformFeePct: 5,
				platformFee: 50,
				earnBackPercentage: 20,
				earnBackBase: 190,
				guaranteedRevenue: 760,
				instructorAmount: 684,
				platformAmount: 126,
				revenueSplitPct: 90,
				paidAt: new Date(),
			},
		});
	}

	it("counts only settled orders — pending and failed never reach the books", async () => {
		await order({ status: "paid", entityTitle: "Counted" });
		await order({ status: "pending", entityTitle: "Not yet paid" });
		await order({ status: "failed", entityTitle: "Never paid" });

		const summary = await service.summary();
		expect(summary.orderCount).toBe(1);
		expect(summary.grossVolume).toBe(1000);
		expect(summary.platformFee).toBe(50);
		expect(summary.platformTake).toBe(126);
		expect(summary.instructorEarnings).toBe(684);
		expect(summary.currency).toBe("NGN");
	});

	it("totals the fee and the platform take across several settled orders", async () => {
		await order({ status: "paid", entityTitle: "One" });
		await order({ status: "earn_back_issued", entityTitle: "Two" });

		const summary = await service.summary();
		expect(summary.orderCount).toBe(2);
		expect(summary.grossVolume).toBe(2000);
		expect(summary.platformFee).toBe(100);
		expect(summary.platformTake).toBe(252);
		expect(summary.instructorEarnings).toBe(1368);
	});

	it("splits Earn-Back into what is still escrowed vs already refunded", async () => {
		await order({ status: "paid", entityTitle: "Still escrowed" });
		await order({ status: "earn_back_issued", entityTitle: "Refunded out" });

		const summary = await service.summary();
		// Two bases of 190; the earn_back_issued one has gone back to the learner.
		expect(summary.earnBackRefunded).toBe(190);
		expect(summary.earnBackEscrowed).toBe(190);
	});

	it("breaks earnings down per entity, biggest earner first", async () => {
		const big = randomUUID();
		const small = randomUUID();
		await order({ status: "paid", entityTitle: "Big seller", entityId: big });
		await order({ status: "paid", entityTitle: "Big seller", entityId: big });
		await order({
			status: "paid",
			entityTitle: "Small seller",
			entityId: small,
			amount: 1000,
		});

		const rows = await service.byEntity();
		expect(rows[0].entityTitle).toBe("Big seller");
		expect(rows[0].orderCount).toBe(2);
		expect(rows[0].grossVolume).toBe(2000);
		expect(rows[0].platformFee).toBe(100);
		expect(rows[1].entityTitle).toBe("Small seller");
		expect(rows[1].orderCount).toBe(1);
	});

	it("reports zeroes rather than throwing when nothing has sold", async () => {
		const summary = await service.summary();
		expect(summary.orderCount).toBe(0);
		expect(summary.grossVolume).toBe(0);
		expect(summary.platformFee).toBe(0);
		expect(await service.byEntity()).toEqual([]);
	});
});
