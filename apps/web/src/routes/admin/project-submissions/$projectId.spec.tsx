// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubmissionRow } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, listProjectSubmissionsMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	listProjectSubmissionsMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, listProjectSubmissions: listProjectSubmissionsMock };
});

function submissionRow(): SubmissionRow {
	return {
		id: "sub1",
		attemptNumber: 1,
		userName: "Chinwe Okafor",
		userEmail: "chinwe@example.com",
		submittedAt: null,
		graded: false,
		score: null,
		passed: null,
	};
}

describe("AdminSubmissionsRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		listProjectSubmissionsMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the admin studio chrome for the submissions queue", async () => {
		listProjectSubmissionsMock.mockResolvedValue([submissionRow()]);
		renderRoute("/admin/project-submissions/proj1");

		expect((await screen.findAllByText("Admin Studio")).length).toBeGreaterThan(
			0,
		);
		expect(await screen.findByText("Chinwe Okafor")).toBeInTheDocument();
	});
});
