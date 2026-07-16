// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptReport, AttemptSummaryRow } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, listAssessmentAttemptsMock, getAttemptReportMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		listAssessmentAttemptsMock: vi.fn(),
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
		listAssessmentAttempts: listAssessmentAttemptsMock,
		getAttemptReport: getAttemptReportMock,
	};
});

// Distinct from the mocked session user's name below — sharing a name made
// `findByText` match the StudioShell sidebar's profile text (which mounts
// immediately from session data) instead of the actual attempt row (which
// only appears once listAssessmentAttempts resolves).
function attemptRow(
	overrides: Partial<AttemptSummaryRow> = {},
): AttemptSummaryRow {
	return {
		id: "att1",
		attemptNumber: 1,
		userName: "Chinwe Okafor",
		userEmail: "chinwe@example.com",
		submittedAt: new Date().toISOString(),
		score: 82,
		passed: true,
		integrityScore: 92,
		flagCount: 0,
		cameraMonitored: true,
		invalidated: false,
		escalated: false,
		...overrides,
	};
}

function fullReport(): AttemptReport {
	return {
		id: "att1",
		attemptNumber: 1,
		userName: "Chinwe Okafor",
		userEmail: "chinwe@example.com",
		submittedAt: new Date().toISOString(),
		score: 82,
		passed: true,
		autoSubmitted: false,
		integrityScore: 92,
		flagCount: 0,
		cameraMonitored: true,
		ipAddress: null,
		userAgent: null,
		invalidated: false,
		invalidatedReason: null,
		escalated: false,
		escalatedReason: null,
		events: [],
	};
}

describe("InstructorAttemptReportsRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listAssessmentAttemptsMock.mockReset();
		getAttemptReportMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
	});

	it("renders the attempt list with score and integrity", async () => {
		listAssessmentAttemptsMock.mockResolvedValue([attemptRow()]);
		renderRoute("/instructor/attempt-reports/a1");

		expect(await screen.findByText("Chinwe Okafor")).toBeInTheDocument();
		expect(screen.getByText("92")).toBeInTheDocument();
	});

	it("shows the empty state when no one has attempted yet", async () => {
		listAssessmentAttemptsMock.mockResolvedValue([]);
		renderRoute("/instructor/attempt-reports/a1");

		expect(
			await screen.findByText("No one has taken this assessment yet."),
		).toBeInTheDocument();
	});

	it("shows invalid/escalated chips for flagged attempts", async () => {
		listAssessmentAttemptsMock.mockResolvedValue([
			attemptRow({ invalidated: true, escalated: true, flagCount: 2 }),
		]);
		renderRoute("/instructor/attempt-reports/a1");

		await screen.findByText("Chinwe Okafor");
		expect(screen.getByText("Invalid")).toBeInTheDocument();
		expect(screen.getByText("Escalated")).toBeInTheDocument();
		expect(screen.getByText("2 flags")).toBeInTheDocument();
	});

	it("opens the attempt report dialog when a row is clicked", async () => {
		listAssessmentAttemptsMock.mockResolvedValue([attemptRow()]);
		getAttemptReportMock.mockResolvedValue(fullReport());
		const user = userEvent.setup();
		renderRoute("/instructor/attempt-reports/a1");
		await screen.findByText("Chinwe Okafor");

		await user.click(screen.getByRole("button", { name: /Chinwe Okafor/ }));

		await waitFor(() => {
			expect(screen.getByText("Integrity report")).toBeInTheDocument();
		});
	});
});
