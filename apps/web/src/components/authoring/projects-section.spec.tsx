// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "@/lib/content-api";
import { renderWithRouter } from "@/test/render";
import { ProjectsSection } from "./projects-section";

const { navigateMock, listProjectsMock, createProjectMock } = vi.hoisted(
	() => ({
		navigateMock: vi.fn(),
		listProjectsMock: vi.fn(),
		createProjectMock: vi.fn(),
	}),
);

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/lib/content-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/content-api")>();
	return {
		...actual,
		listProjects: listProjectsMock,
		createProject: createProjectMock,
	};
});

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
	return {
		id: "proj1",
		scope: "course",
		title: "Build a todo app",
		description: null,
		submissionTypes: ["file_upload"],
		gradingType: "manual",
		passMark: 70,
		dueAt: null,
		courseId: "c1",
		pathId: null,
		cohortId: null,
		orderIndex: 0,
		_count: { submissions: 3 },
		...overrides,
	};
}

describe("ProjectsSection", () => {
	beforeEach(() => {
		navigateMock.mockReset();
		listProjectsMock.mockReset();
		createProjectMock.mockReset();
	});

	it("renders existing projects with their grading type and submission count", async () => {
		listProjectsMock.mockResolvedValue([project()]);
		renderWithRouter(
			<ProjectsSection
				scope="course"
				parent={{ courseId: "c1" }}
				area="instructor"
			/>,
		);
		expect(await screen.findByText("Build a todo app")).toBeInTheDocument();
		expect(screen.getByText("Manual · 3 submissions")).toBeInTheDocument();
	});

	it("opens a project's editor when clicked", async () => {
		listProjectsMock.mockResolvedValue([project()]);
		const user = userEvent.setup();
		renderWithRouter(
			<ProjectsSection
				scope="course"
				parent={{ courseId: "c1" }}
				area="admin"
			/>,
		);
		await user.click(await screen.findByText("Build a todo app"));
		expect(navigateMock).toHaveBeenCalledWith({
			to: "/admin/projects/$projectId",
			params: { projectId: "proj1" },
		});
	});

	it("keeps 'Add project' disabled with a blank title", async () => {
		listProjectsMock.mockResolvedValue([]);
		renderWithRouter(
			<ProjectsSection
				scope="course"
				parent={{ courseId: "c1" }}
				area="instructor"
			/>,
		);
		const addButton = await screen.findByRole("button", {
			name: /Add project/,
		});
		await userEvent.setup().click(addButton);
		expect(createProjectMock).not.toHaveBeenCalled();
	});

	it("creates a project with the entered title and opens its editor", async () => {
		listProjectsMock.mockResolvedValue([]);
		createProjectMock.mockResolvedValue(project({ id: "proj2" }));
		const user = userEvent.setup();
		renderWithRouter(
			<ProjectsSection
				scope="course"
				parent={{ courseId: "c1" }}
				area="instructor"
			/>,
		);

		const input = await screen.findByPlaceholderText("New project title…");
		await user.type(input, "Ship a landing page");
		await user.click(screen.getByRole("button", { name: /Add project/ }));

		await waitFor(() => {
			expect(createProjectMock).toHaveBeenCalledWith({
				scope: "course",
				title: "Ship a landing page",
				courseId: "c1",
			});
		});
		expect(navigateMock).toHaveBeenCalledWith({
			to: "/instructor/projects/$projectId",
			params: { projectId: "proj2" },
		});
	});
});
