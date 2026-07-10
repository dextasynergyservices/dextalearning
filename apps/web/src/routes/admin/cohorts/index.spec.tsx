// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CohortSummary } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, listCohortsMock, createCohortMock, deleteCohortMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		listCohortsMock: vi.fn(),
		createCohortMock: vi.fn(),
		deleteCohortMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		listCohorts: listCohortsMock,
		createCohort: createCohortMock,
		deleteCohort: deleteCohortMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function cohort(overrides: Partial<CohortSummary> = {}): CohortSummary {
	return {
		id: "co1",
		title: "January Cohort",
		slug: "january-cohort",
		status: "open",
		startsAt: "2026-08-01T00:00:00.000Z",
		endsAt: null,
		capacity: 30,
		seatsFilled: 5,
		price: 2000,
		isFree: false,
		currency: "NGN",
		isEarnBackEligible: false,
		earnBackPercentage: null,
		createdAt: new Date().toISOString(),
		_count: { courses: 2 },
		...overrides,
	};
}

describe("CohortsListPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listCohortsMock.mockReset();
		createCohortMock.mockReset();
		deleteCohortMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the cohort list with status and price", async () => {
		listCohortsMock.mockResolvedValue([cohort()]);
		renderRoute("/admin/cohorts");

		expect(await screen.findByText("January Cohort")).toBeInTheDocument();
		expect(screen.getByText("₦2,000")).toBeInTheDocument();
	});

	it("shows the empty state when there are no cohorts", async () => {
		listCohortsMock.mockResolvedValue([]);
		renderRoute("/admin/cohorts");

		expect(
			await screen.findByText("No cohorts yet — schedule your first run."),
		).toBeInTheDocument();
	});

	it("creates a cohort from the inline form", async () => {
		listCohortsMock.mockResolvedValue([]);
		createCohortMock.mockResolvedValue(cohort({ id: "co2" }));
		const user = userEvent.setup();
		renderRoute("/admin/cohorts");
		await screen.findByText("No cohorts yet — schedule your first run.");

		await user.click(screen.getAllByRole("button", { name: "New cohort" })[0]);
		await user.type(
			screen.getByPlaceholderText("Cohort title"),
			"March Cohort",
		);
		await user.click(screen.getByRole("button", { name: "Create cohort" }));

		await waitFor(() => {
			expect(createCohortMock).toHaveBeenCalledWith({ title: "March Cohort" });
		});
	});

	it("deletes a cohort after confirming", async () => {
		const { toast } = await import("sonner");
		listCohortsMock.mockResolvedValue([cohort()]);
		deleteCohortMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/admin/cohorts");
		await screen.findByText("January Cohort");

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(await screen.findByText("Delete cohort?")).toBeInTheDocument();
		await user.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: "Delete",
			}),
		);

		await waitFor(() => {
			expect(deleteCohortMock).toHaveBeenCalledWith("co1");
		});
		expect(toast.success).toHaveBeenCalledWith("Cohort deleted");
	});
});
