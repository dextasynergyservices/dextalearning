// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectDetail } from "@/lib/content-api";
import { renderRoute } from "@/test/render-route";

const { useSessionMock, getProjectMock, updateProjectMock, deleteProjectMock } =
	vi.hoisted(() => ({
		useSessionMock: vi.fn(),
		getProjectMock: vi.fn(),
		updateProjectMock: vi.fn(),
		deleteProjectMock: vi.fn(),
	}));

vi.mock("@/lib/auth-client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/auth-client")>();
	return { ...actual, useSession: useSessionMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		getProject: getProjectMock,
		updateProject: updateProjectMock,
		deleteProject: deleteProjectMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function projectDetail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
	return {
		id: "proj1",
		scope: "course",
		title: "Build a todo app",
		description: "Ship a working CRUD app.",
		submissionTypes: ["file_upload"],
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
		...overrides,
	};
}

describe("InstructorProjectRoute", () => {
	beforeEach(() => {
		useSessionMock.mockReset();
		getProjectMock.mockReset();
		updateProjectMock.mockReset();
		deleteProjectMock.mockReset();
		useSessionMock.mockReturnValue({
			data: { user: { id: "u1", name: "Ada Lovelace", role: "instructor" } },
			isPending: false,
		});
	});

	it("renders the project form prefilled with existing values", async () => {
		getProjectMock.mockResolvedValue(projectDetail());
		renderRoute("/instructor/projects/proj1");

		expect(
			await screen.findByDisplayValue("Build a todo app"),
		).toBeInTheDocument();
		expect(
			screen.getByDisplayValue("Ship a working CRUD app."),
		).toBeInTheDocument();
	});

	it("shows the file-size fields only when file upload is an accepted type", async () => {
		getProjectMock.mockResolvedValue(
			projectDetail({ submissionTypes: ["text_submission"] }),
		);
		renderRoute("/instructor/projects/proj1");
		await screen.findByDisplayValue("Build a todo app");

		expect(screen.queryByText("Max file size (MB)")).not.toBeInTheDocument();
	});

	it("adds a rubric criterion and shows the running point total", async () => {
		getProjectMock.mockResolvedValue(projectDetail());
		const user = userEvent.setup();
		renderRoute("/instructor/projects/proj1");
		await screen.findByDisplayValue("Build a todo app");

		await user.click(screen.getByRole("button", { name: "Add criterion" }));

		expect(
			screen.getByPlaceholderText("Criterion (e.g. Code quality)"),
		).toBeInTheDocument();
		expect(screen.getByText("10 pts")).toBeInTheDocument();
	});

	it("saves the project settings", async () => {
		const { toast } = await import("sonner");
		getProjectMock.mockResolvedValue(projectDetail());
		updateProjectMock.mockResolvedValue(projectDetail());
		const user = userEvent.setup();
		renderRoute("/instructor/projects/proj1");
		await screen.findByDisplayValue("Build a todo app");

		await user.click(screen.getByRole("button", { name: "Save project" }));

		await waitFor(() => {
			expect(updateProjectMock).toHaveBeenCalledWith(
				"proj1",
				expect.objectContaining({ title: "Build a todo app", passMark: 70 }),
			);
		});
		expect(toast.success).toHaveBeenCalledWith("Project saved");
	});

	it("deletes the project after confirming", async () => {
		const { toast } = await import("sonner");
		getProjectMock.mockResolvedValue(projectDetail());
		deleteProjectMock.mockResolvedValue({});
		const user = userEvent.setup();
		renderRoute("/instructor/projects/proj1");
		await screen.findByDisplayValue("Build a todo app");

		await user.click(screen.getByRole("button", { name: "Delete" }));
		expect(await screen.findByText("Delete project?")).toBeInTheDocument();
		// Confirm and cancel both reuse the plain "Delete"/"Cancel" labels.
		const confirmButtons = screen.getAllByRole("button", { name: "Delete" });
		await user.click(confirmButtons[confirmButtons.length - 1]);

		await waitFor(() => {
			expect(deleteProjectMock).toHaveBeenCalledWith("proj1");
		});
		expect(toast.success).toHaveBeenCalledWith("Project deleted");
	});
});
