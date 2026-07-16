// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SaleLedgerRow, SaleLedgerView } from "@/lib/earnings-api";
import { renderWithProviders } from "@/test/render";
import { EarnBackLedger } from "./earn-back-ledger";

const { getEarningsLedgerMock } = vi.hoisted(() => ({
	getEarningsLedgerMock: vi.fn(),
}));

vi.mock("@/lib/earnings-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/earnings-api")>();
	return { ...actual, getEarningsLedger: getEarningsLedgerMock };
});

function row(overrides: Partial<SaleLedgerRow> = {}): SaleLedgerRow {
	return {
		orderId: "o1",
		entityType: "course",
		entityTitle: "Basics of Children Education",
		learnerName: "Amara Okafor",
		currency: "NGN",
		gross: 7500,
		earnBackPercentage: 100,
		outcome: "finished_on_time",
		guaranteed: 0,
		atStake: 0,
		earnedFromEscrow: 0,
		totalEarned: 0,
		daysLate: 0,
		deadline: null,
		soldAt: "2026-07-15T10:00:00.000Z",
		...overrides,
	};
}

function view(rows: SaleLedgerRow[]): SaleLedgerView {
	return {
		currency: "NGN",
		summary: {
			salesCount: rows.length,
			grossMinor: 0,
			earnedMinor: 0,
			atStakeMinor: 0,
			finishedOnTimeCount: rows.filter((r) => r.outcome === "finished_on_time")
				.length,
			grossMajor: rows.reduce((s, r) => s + r.gross, 0),
			earnedMajor: rows.reduce((s, r) => s + r.totalEarned, 0),
			atStakeMajor: rows.reduce((s, r) => s + r.atStake, 0),
		},
		rows,
	};
}

describe("EarnBackLedger (§8.5)", () => {
	beforeEach(() => vi.clearAllMocks());

	/**
	 * The reason this component exists: the payout table is empty for this sale,
	 * so the ledger has to prove the sale happened at all.
	 */
	it("shows an on-time sale that earned nothing, and says why", async () => {
		getEarningsLedgerMock.mockResolvedValue(view([row()]));
		renderWithProviders(<EarnBackLedger />);

		expect(
			await screen.findByText("Basics of Children Education"),
		).toBeInTheDocument();
		expect(screen.getByText("Finished on time")).toBeInTheDocument();
		// The zero is never left unexplained.
		expect(
			screen.getByText(/They finished in time and earned their money back/),
		).toBeInTheDocument();
	});

	it("frames on-time finishers as the success they are", async () => {
		getEarningsLedgerMock.mockResolvedValue(
			view([row(), row({ orderId: "o2" })]),
		);
		renderWithProviders(<EarnBackLedger />);

		expect(
			await screen.findByText(/2 of 2 learners finished on time/),
		).toBeInTheDocument();
	});

	it("hides the success headline when nobody has finished on time", async () => {
		getEarningsLedgerMock.mockResolvedValue(
			view([row({ outcome: "at_stake", atStake: 6412.5, daysLate: null })]),
		);
		renderWithProviders(<EarnBackLedger />);

		await screen.findByText("Basics of Children Education");
		expect(screen.queryByText(/finished on time\./)).not.toBeInTheDocument();
	});

	/**
	 * The money rule: an open escrow's upside is conditional, so it must never
	 * be presented as earned. It appears only in "only if" language.
	 */
	it("states an open escrow's upside as conditional, never as earned", async () => {
		getEarningsLedgerMock.mockResolvedValue(
			view([
				row({
					outcome: "at_stake",
					atStake: 6412.5,
					totalEarned: 0,
					daysLate: null,
					deadline: "2026-08-14T00:00:00.000Z",
				}),
			]),
		);
		renderWithProviders(<EarnBackLedger />);

		// "At stake" is deliberately the same word on the summary figure and the
		// row pill, so scope to the row rather than matching both.
		const sale = within(await screen.findByRole("listitem"));
		expect(sale.getByText("At stake")).toBeInTheDocument();
		expect(sale.getByText(/only if they miss/)).toBeInTheDocument();
		// The conditional upside must never be rendered as money earned.
		expect(sale.queryByText("₦6,412.50")).not.toBeInTheDocument();
		// The at-stake figure carries its condition wherever it is shown.
		expect(
			screen.getByText(/Only if deadlines are missed/),
		).toBeInTheDocument();
	});

	it("credits a late finish to the creator", async () => {
		getEarningsLedgerMock.mockResolvedValue(
			view([
				row({
					outcome: "finished_late",
					daysLate: 12,
					earnedFromEscrow: 1710,
					totalEarned: 1710,
				}),
			]),
		);
		renderWithProviders(<EarnBackLedger />);

		expect(await screen.findByText("Finished late")).toBeInTheDocument();
		expect(screen.getByText(/Finished 12 days late/)).toBeInTheDocument();
	});

	it("distinguishes no sales from sales that earned nothing", async () => {
		getEarningsLedgerMock.mockResolvedValue(view([]));
		renderWithProviders(<EarnBackLedger />);

		expect(await screen.findByText("No sales yet")).toBeInTheDocument();
		expect(
			screen.getByText(/including sales that earn you nothing/),
		).toBeInTheDocument();
	});
});
