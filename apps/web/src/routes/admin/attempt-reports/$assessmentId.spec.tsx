// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptSummaryRow } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, listAssessmentAttemptsMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listAssessmentAttemptsMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, listAssessmentAttempts: listAssessmentAttemptsMock };
});

function attemptRow(): AttemptSummaryRow {
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
	};
}

describe("AdminAttemptReportsRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listAssessmentAttemptsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the admin studio chrome for the attempts list", async () => {
		listAssessmentAttemptsMock.mockResolvedValue([attemptRow()]);
		renderRoute("/admin/attempt-reports/a1");

		expect((await screen.findAllByText("Admin Studio")).length).toBeGreaterThan(
			0,
		);
		expect(await screen.findByText("Chinwe Okafor")).toBeInTheDocument();
	});
});
