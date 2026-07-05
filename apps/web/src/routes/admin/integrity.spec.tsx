// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptReport, IntegrityReportRow } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, listAllIntegrityReportsMock, getAttemptReportMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		listAllIntegrityReportsMock: vi.fn(),
		getAttemptReportMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		listAllIntegrityReports: listAllIntegrityReportsMock,
		getAttemptReport: getAttemptReportMock,
	};
});

function integrityRow(
	overrides: Partial<IntegrityReportRow> = {},
): IntegrityReportRow {
	return {
		id: "att1",
		attemptNumber: 1,
		userName: "Chinwe Okafor",
		userEmail: "chinwe@example.com",
		submittedAt: new Date().toISOString(),
		score: 82,
		passed: true,
		integrityScore: 55,
		flagCount: 3,
		invalidated: false,
		escalated: true,
		assessmentId: "a1",
		assessmentTitle: "Module quiz",
		scope: "module",
		...overrides,
	};
}

describe("AdminIntegrityPage", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listAllIntegrityReportsMock.mockReset();
		getAttemptReportMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the flagged attempts with score and escalated chip", async () => {
		listAllIntegrityReportsMock.mockResolvedValue([integrityRow()]);
		renderRoute("/admin/integrity");

		expect(await screen.findByText("Module quiz")).toBeInTheDocument();
		expect(screen.getByText("Chinwe Okafor")).toBeInTheDocument();
		expect(screen.getByText("55")).toBeInTheDocument();
		expect(screen.getByText("Escalated")).toBeInTheDocument();
		expect(screen.getByText("3 flags")).toBeInTheDocument();
	});

	it("shows the clean-platform empty state", async () => {
		listAllIntegrityReportsMock.mockResolvedValue([]);
		renderRoute("/admin/integrity");

		expect(
			await screen.findByText("No flagged attempts across the platform."),
		).toBeInTheDocument();
	});

	it("opens the attempt report dialog when a row is clicked", async () => {
		listAllIntegrityReportsMock.mockResolvedValue([integrityRow()]);
		const fullReport: AttemptReport = {
			id: "att1",
			attemptNumber: 1,
			userName: "Chinwe Okafor",
			userEmail: "chinwe@example.com",
			submittedAt: new Date().toISOString(),
			score: 82,
			passed: true,
			autoSubmitted: false,
			integrityScore: 55,
			flagCount: 3,
			ipAddress: null,
			userAgent: null,
			invalidated: false,
			invalidatedReason: null,
			escalated: true,
			escalatedReason: null,
			events: [],
		};
		getAttemptReportMock.mockResolvedValue(fullReport);
		const user = userEvent.setup();
		renderRoute("/admin/integrity");
		await screen.findByText("Module quiz");

		await user.click(screen.getByRole("button", { name: /Module quiz/ }));

		await waitFor(() => {
			expect(screen.getByText("Integrity report")).toBeInTheDocument();
		});
	});
});
