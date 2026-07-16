// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	PlatformEarningsRow,
	PlatformEarningsSummary,
} from "@/lib/admin-earnings-api";
import { renderRoute } from "@/test/render-route";

const { getPlatformEarningsMock, useSessionMock } = vi.hoisted(() => ({
	getPlatformEarningsMock: vi.fn(),
	useSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/admin-earnings-api", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/admin-earnings-api")>();
	return { ...actual, getPlatformEarnings: getPlatformEarningsMock };
});

function summary(
	overrides: Partial<PlatformEarningsSummary> = {},
): PlatformEarningsSummary {
	return {
		currency: "NGN",
		grossVolume: 2000,
		platformFee: 100,
		platformTake: 252,
		instructorEarnings: 1368,
		earnBackEscrowed: 190,
		earnBackRefunded: 190,
		orderCount: 2,
		...overrides,
	};
}

function row(
	overrides: Partial<PlatformEarningsRow> = {},
): PlatformEarningsRow {
	return {
		entityType: "course",
		entityId: "c1",
		entityTitle: "Intro to Systems",
		currency: "NGN",
		orderCount: 2,
		grossVolume: 2000,
		platformFee: 100,
		platformTake: 252,
		instructorEarnings: 1368,
		...overrides,
	};
}

describe("AdminEarningsPage (§2, §15)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("shows the platform's take and the fee it collected", async () => {
		getPlatformEarningsMock.mockResolvedValue({
			summary: summary(),
			entities: [row()],
		});
		renderRoute("/admin/earnings");

		// The heading renders while loading — wait for a tile, not the title.
		expect(await screen.findByText("Platform take")).toBeInTheDocument();
		expect(screen.getByText("Platform earnings")).toBeInTheDocument();
		expect(screen.getByText("Platform fee")).toBeInTheDocument();
		expect(screen.getByText("2 settled orders")).toBeInTheDocument();
	});

	it("keeps Earn-Back visible as money owed, separate from the take", async () => {
		getPlatformEarningsMock.mockResolvedValue({
			summary: summary(),
			entities: [row()],
		});
		renderRoute("/admin/earnings");

		expect(await screen.findByText("Earn-Back held")).toBeInTheDocument();
		expect(screen.getByText("Earn-Back refunded")).toBeInTheDocument();
	});

	it("breaks the total down per entity", async () => {
		getPlatformEarningsMock.mockResolvedValue({
			summary: summary(),
			entities: [row(), row({ entityId: "c2", entityTitle: "Advanced Go" })],
		});
		renderRoute("/admin/earnings");

		expect(await screen.findByText("Where it came from")).toBeInTheDocument();
		// Rendered twice — once in the desktop table, once in the mobile list.
		expect(screen.getAllByText("Intro to Systems").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Advanced Go").length).toBeGreaterThan(0);
	});

	it("explains the empty state rather than showing a bare zero table", async () => {
		getPlatformEarningsMock.mockResolvedValue({
			summary: summary({
				grossVolume: 0,
				platformFee: 0,
				platformTake: 0,
				instructorEarnings: 0,
				earnBackEscrowed: 0,
				earnBackRefunded: 0,
				orderCount: 0,
			}),
			entities: [],
		});
		renderRoute("/admin/earnings");

		expect(await screen.findByText("No sales yet")).toBeInTheDocument();
	});
});
