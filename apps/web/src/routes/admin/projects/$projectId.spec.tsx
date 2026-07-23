// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getProjectMock } = vi.hoisted(() => ({
	useSessionMock: vi.fn(),
	getProjectMock: vi.fn(),
}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return { ...actual, getProject: getProjectMock };
});

function projectDetail(): ProjectDetail {
	return {
		id: "proj1",
		scope: "course",
		title: "Build a todo app",
		description: null,
		submissionTypes: ["file_upload"],
		codeConfigJson: null,
		gradingType: "manual",
		passMark: 70,
		dueAt: null,
		courseId: "c1",
		pathId: null,
		cohortId: null,
		orderIndex: 0,
		rubricJson: [],
		allowedFileTypes: [],
		maxFileSizeMb: 50,
		peerReviewCount: 2,
		maxAttempts: null,
		retryCooldownHours: null,
		retryLockoutDays: null,
	};
}

describe("AdminProjectRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getProjectMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "admin" } },
			isPending: false,
		});
	});

	it("renders the admin studio chrome for the project editor", async () => {
		getProjectMock.mockResolvedValue(projectDetail());
		renderRoute("/admin/projects/proj1");

		expect((await screen.findAllByText("Admin Studio")).length).toBeGreaterThan(
			0,
		);
		expect(
			await screen.findByDisplayValue("Build a todo app"),
		).toBeInTheDocument();
	});
});
